update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now()))
where email = 'shaz@onlinebuzz.co.uk';

update crm.user_profiles
set
  role = 'management',
  full_name = coalesce(nullif(full_name, ''), 'Shaz Iqbal'),
  email = coalesce(email, 'shaz@onlinebuzz.co.uk')
where user_id in (
  select id
  from auth.users
  where email = 'shaz@onlinebuzz.co.uk'
);
