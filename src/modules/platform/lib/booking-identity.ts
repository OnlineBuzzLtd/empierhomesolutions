export type BookingCustomerIdentity = {
  name: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
};

export type BookingCustomerMatch = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  postcode: string | null;
};

export type BookingIdentityConflict = {
  conflictingCustomerId: string;
  reason: string;
};

export function normalizeBookingPhone(value: string | null) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/[^\d+]/g, "");
  return digits.length > 0 ? digits : null;
}

export function normalizeBookingEmail(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeBookingPostcode(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeBookingText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

function isPlaceholderName(value: string | null) {
  const normalized = normalizeBookingText(value);
  return (
    !normalized ||
    normalized === "unknown customer" ||
    normalized === "live tester" ||
    normalized.startsWith("customer 44") ||
    normalized.startsWith("customer 0")
  );
}

function hasMeaningfulMismatch(left: string | null, right: string | null) {
  const normalizedLeft = normalizeBookingText(left);
  const normalizedRight = normalizeBookingText(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft !== normalizedRight);
}

export function detectBookingIdentityConflict(
  customer: BookingCustomerMatch,
  booking: BookingCustomerIdentity,
): BookingIdentityConflict | null {
  if (!customer.id) {
    return null;
  }

  const bookingName = normalizeBookingText(booking.name);
  const existingName = normalizeBookingText(customer.full_name);
  if (bookingName && existingName && !isPlaceholderName(customer.full_name) && bookingName !== existingName) {
    return {
      conflictingCustomerId: customer.id,
      reason: `Phone or email matched ${customer.full_name}, but the booking name is ${booking.name}.`,
    };
  }

  const bookingPostcode = normalizeBookingPostcode(booking.postcode);
  const existingPostcode = normalizeBookingPostcode(customer.postcode);
  if (bookingPostcode && existingPostcode && bookingPostcode !== existingPostcode) {
    return {
      conflictingCustomerId: customer.id,
      reason: `Phone or email matched ${customer.full_name ?? "an existing customer"}, but the booking postcode is ${booking.postcode}.`,
    };
  }

  if (hasMeaningfulMismatch(customer.address_line1, booking.addressLine1)) {
    return {
      conflictingCustomerId: customer.id,
      reason: `Phone or email matched ${customer.full_name ?? "an existing customer"}, but the booking address is different.`,
    };
  }

  return null;
}

export function buildBookingReviewMetadata(input: {
  bookingId: string | null;
  externalLeadId: string | null;
  channel: string | null;
  customer: BookingCustomerIdentity;
  conflict: BookingIdentityConflict;
}) {
  return {
    needs_review: true,
    review_reason: input.conflict.reason,
    conflicting_customer_id: input.conflict.conflictingCustomerId,
    platform_booking_id: input.bookingId,
    platform_lead_id: input.externalLeadId,
    latest_channel: input.channel,
    review_customer_name: input.customer.name,
    review_customer_phone: input.customer.phone,
    review_customer_email: input.customer.email,
    review_customer_address: input.customer.addressLine1,
    review_customer_postcode: input.customer.postcode,
  };
}
