import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const tenant = "11111111-1111-4111-8111-111111111111";
const otherTenant = "22222222-2222-4222-8222-222222222222";
const customer = "33333333-3333-4333-8333-333333333333";
const otherCustomer = "44444444-4444-4444-8444-444444444444";
let db: PGlite;

describe("site management migration on PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create schema crm;
      create role authenticated;
      create table crm.tenants (id uuid primary key);
      create table crm.customers (id uuid primary key, tenant_id uuid not null);
      create function crm.current_user_tenant_id() returns uuid language sql as $$ select '${tenant}'::uuid $$;
      create function crm.is_manager_or_admin(uuid) returns boolean language sql as $$ select $1 = '${tenant}'::uuid $$;
    `);
    const original = await readFile("supabase/migrations/202603270002_crm_sites_job_assignees.sql", "utf8");
    // Use the actual deployed site/contact table definitions, not copies.
    await db.exec(original.split("create table if not exists crm.job_assignees")[0]);
    await db.exec(`
      create table crm.jobs (id uuid primary key default gen_random_uuid(), site_id uuid references crm.sites(id) on delete set null);
      insert into crm.tenants values ('${tenant}'), ('${otherTenant}');
      insert into crm.customers values ('${customer}', '${tenant}'), ('${otherCustomer}', '${otherTenant}');
    `);
    await db.exec(await readFile("supabase/migrations/202609150001_crm_site_management.sql", "utf8"));
  });
  beforeEach(async () => {
    await db.exec("truncate crm.jobs, crm.site_contacts, crm.sites cascade");
  });
  afterAll(async () => {
    await db?.close();
  });

  async function insert(label: string, primary = false, tenantId = tenant, customerId = customer) {
    const { rows } = await db.query<{ id: string }>(
      "insert into crm.sites (tenant_id, customer_id, label, is_primary) values ($1,$2,$3,$4) returning id",
      [tenantId, customerId, label, primary],
    );
    return rows[0].id;
  }
  async function primaryIds() {
    return (
      await db.query<{ id: string }>("select id from crm.sites where is_primary and tenant_id = $1", [tenant])
    ).rows.map((r) => r.id);
  }

  it("allows multiple sites and changes the primary without affecting another tenant", async () => {
    await insert("Home", true);
    const second = await insert("Rental", true);
    const foreign = await insert("Office", true, otherTenant, otherCustomer);
    expect(await primaryIds()).toEqual([second]);
    expect((await db.query("select is_primary from crm.sites where id = $1", [foreign])).rows).toEqual([
      { is_primary: true },
    ]);
  });

  it("switches the primary when an existing site is selected", async () => {
    await insert("Home", true);
    const second = await insert("Rental");
    await db.query("update crm.sites set is_primary = true where id = $1", [second]);
    expect(await primaryIds()).toEqual([second]);
  });

  it("rolls back the previous primary change if the replacement fails to save", async () => {
    const first = await insert("Home", true);
    await expect(
      db.query("insert into crm.sites (tenant_id, customer_id, label, is_primary) values ($1,$2,null,true)", [
        tenant,
        customer,
      ]),
    ).rejects.toMatchObject({ code: "23502" });
    expect(await primaryIds()).toEqual([first]);
  });

  it("has a unique index enforcing at most one primary even when the trigger is bypassed", async () => {
    await insert("Home", true);
    await db.exec("alter table crm.sites disable trigger crm_sites_switch_primary");
    try {
      await expect(insert("Rental", true)).rejects.toMatchObject({ code: "23505" });
    } finally {
      await db.exec("alter table crm.sites enable trigger crm_sites_switch_primary");
    }
  });

  it("rejects a site assigned to a customer in another tenant", async () => {
    await expect(insert("Rental", true, tenant, otherCustomer)).rejects.toMatchObject({ code: "42501" });
  });

  it.each(["jobs", "site_contacts"])("refuses to delete a site linked to %s", async (table) => {
    const site = await insert("Home", true);
    if (table === "jobs") await db.query("insert into crm.jobs (site_id) values ($1)", [site]);
    else
      await db.query("insert into crm.site_contacts (site_id, full_name) values ($1, 'Site contact')", [
        site,
      ]);
    await expect(db.query("select crm.delete_unused_site($1,$2)", [site, tenant])).rejects.toMatchObject({
      code: "23503",
    });
    expect(await primaryIds()).toEqual([site]);
  });

  it("deletes only an unused site in the requested workspace", async () => {
    const site = await insert("Home");
    await db.query("select crm.delete_unused_site($1,$2)", [site, tenant]);
    expect((await db.query("select id from crm.sites where id = $1", [site])).rows).toEqual([]);
  });

  it("does not grant deletion in another workspace", async () => {
    const site = await insert("Office", false, otherTenant, otherCustomer);
    await expect(db.query("select crm.delete_unused_site($1,$2)", [site, otherTenant])).rejects.toMatchObject(
      { code: "42501" },
    );
    expect(
      (await db.query("select crm.delete_unused_site($1,$2) is null as missing", [site, tenant])).rows,
    ).toEqual([{ missing: true }]);
  });
});
