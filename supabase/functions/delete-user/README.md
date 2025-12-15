# Delete User Edge Function

This Edge Function deletes a user from Supabase Auth using admin privileges.

## Setup

1. Deploy the function:
   ```bash
   supabase functions deploy delete-user
   ```

2. The function requires the `SUPABASE_SERVICE_ROLE_KEY` environment variable to be set in your Supabase project settings.

## Usage

The function is called automatically from the Admin panel when deleting a user. It requires:
- `user_id`: The UUID of the user to delete from auth.users

## Security

- Only admins can call this function (enforced by RLS on the database function)
- Uses service role key for admin-level operations
- CORS is enabled for cross-origin requests

## Note

If the Edge Function is not deployed, the admin panel will still delete all user data from the database, but the auth user account will need to be deleted manually from the Supabase dashboard.

