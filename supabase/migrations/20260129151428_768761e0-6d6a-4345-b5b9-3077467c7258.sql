-- ============================================
-- FINAL SECURITY: STRICT RLS ENFORCEMENT
-- ============================================

-- STEP 1: Drop existing policies that may be too permissive
-- We'll recreate them with stricter definitions

-- PROFILES: Drop and recreate with strict user-only access
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Accountants can view all profiles" ON public.profiles;

-- PROFILES: Strict policies
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to profiles" ON public.profiles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Accountants can view profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

-- INVOICES: Drop and recreate with strict user-only access
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update own pending invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Managers can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Accountants can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Accountants can update invoice payment" ON public.invoices;

-- INVOICES: Strict policies
CREATE POLICY "Users can view own invoices" ON public.invoices
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" ON public.invoices
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending invoices" ON public.invoices
FOR UPDATE USING (auth.uid() = user_id AND status = 'pending') 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to invoices" ON public.invoices
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view invoices" ON public.invoices
FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Accountants can view invoices" ON public.invoices
FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can update invoice payment status" ON public.invoices
FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'accountant'));

-- PERFORMANCE_RECORDS: Drop and recreate with strict user-only access
DROP POLICY IF EXISTS "Users can view own performance records" ON public.performance_records;
DROP POLICY IF EXISTS "Users can insert own performance records" ON public.performance_records;
DROP POLICY IF EXISTS "Users can update own draft or returned performance records" ON public.performance_records;
DROP POLICY IF EXISTS "Users can delete own draft performance records" ON public.performance_records;
DROP POLICY IF EXISTS "Privileged users can view all performance records" ON public.performance_records;
DROP POLICY IF EXISTS "Admins can update all performance records" ON public.performance_records;
DROP POLICY IF EXISTS "Managers can update all performance records" ON public.performance_records;

-- PERFORMANCE_RECORDS: Strict policies
CREATE POLICY "Users can view own records" ON public.performance_records
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records" ON public.performance_records
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft or returned records" ON public.performance_records
FOR UPDATE USING (auth.uid() = user_id AND status IN ('draft', 'returned'))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft records" ON public.performance_records
FOR DELETE USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Admins have full access to records" ON public.performance_records
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view all records" ON public.performance_records
FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update records" ON public.performance_records
FOR UPDATE USING (public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Accountants can view records" ON public.performance_records
FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

-- USER_ROLES: Ensure admins have full control
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));