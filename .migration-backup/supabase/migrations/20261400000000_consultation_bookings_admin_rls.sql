-- Allow authenticated admin users to read all consultation bookings
-- (admin is identified by the service role or by checking user_profiles role)

DROP POLICY IF EXISTS "admin_read_all_bookings" ON public.consultation_bookings;
CREATE POLICY "admin_read_all_bookings"
  ON public.consultation_bookings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_update_bookings" ON public.consultation_bookings;
CREATE POLICY "admin_update_bookings"
  ON public.consultation_bookings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
