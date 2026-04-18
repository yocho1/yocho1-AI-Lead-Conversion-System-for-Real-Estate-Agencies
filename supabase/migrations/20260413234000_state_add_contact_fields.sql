update public.leads
set lead_state = coalesce(lead_state, '{}'::jsonb)
  || jsonb_build_object(
    'id', coalesce(lead_state->>'id', id::text),
    'name', coalesce(lead_state->>'name', name),
    'email', coalesce(lead_state->>'email', email),
    'phone', coalesce(lead_state->>'phone', phone),
    'contact', coalesce(lead_state->>'contact', email, phone),
    'last_question', coalesce(lead_state->>'last_question', null)
  );
