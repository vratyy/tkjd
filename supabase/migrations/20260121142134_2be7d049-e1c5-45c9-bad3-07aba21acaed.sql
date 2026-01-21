
-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('monter', 'manager', 'admin', 'accountant');

-- Create enum for performance record status
CREATE TYPE public.record_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- Create enum for weekly closing status
CREATE TYPE public.closing_status AS ENUM ('open', 'submitted', 'approved', 'locked');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    company_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    location TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create performance_records table
CREATE TABLE public.performance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    time_from TIME NOT NULL,
    time_to TIME NOT NULL,
    break_minutes INTEGER NOT NULL DEFAULT 0,
    total_hours NUMERIC(5,2) GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (time_to - time_from)) / 3600 - (break_minutes::NUMERIC / 60)
    ) STORED,
    note TEXT,
    status record_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create weekly_closings table
CREATE TABLE public.weekly_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    calendar_week INTEGER NOT NULL CHECK (calendar_week >= 1 AND calendar_week <= 53),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    status closing_status NOT NULL DEFAULT 'open',
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, calendar_week, year)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_closings ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'manager'));

-- User roles policies
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Projects policies (viewable by all authenticated, manageable by admin/manager)
CREATE POLICY "Authenticated users can view active projects"
ON public.projects FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage projects"
ON public.projects FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage projects"
ON public.projects FOR ALL
USING (public.has_role(auth.uid(), 'manager'));

-- Performance records policies
CREATE POLICY "Users can view own records"
ON public.performance_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records"
ON public.performance_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft records"
ON public.performance_records FOR UPDATE
USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Users can delete own draft records"
ON public.performance_records FOR DELETE
USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Managers can view all records"
ON public.performance_records FOR SELECT
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can view all records"
ON public.performance_records FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can view all records"
ON public.performance_records FOR SELECT
USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Managers can update record status"
ON public.performance_records FOR UPDATE
USING (public.has_role(auth.uid(), 'manager'));

-- Weekly closings policies
CREATE POLICY "Users can view own closings"
ON public.weekly_closings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own closings"
ON public.weekly_closings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own open closings"
ON public.weekly_closings FOR UPDATE
USING (auth.uid() = user_id AND status = 'open');

CREATE POLICY "Managers can view all closings"
ON public.weekly_closings FOR SELECT
USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins can view all closings"
ON public.weekly_closings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Accountants can view all closings"
ON public.weekly_closings FOR SELECT
USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Managers can update closings"
ON public.weekly_closings FOR UPDATE
USING (public.has_role(auth.uid(), 'manager'));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_performance_records_updated_at
BEFORE UPDATE ON public.performance_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_closings_updated_at
BEFORE UPDATE ON public.weekly_closings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, company_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        NEW.raw_user_meta_data->>'company_name'
    );
    
    -- Default role is 'monter' for new users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'monter');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
