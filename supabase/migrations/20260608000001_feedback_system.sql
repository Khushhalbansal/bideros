CREATE TABLE IF NOT EXISTS public.user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_url text,
  feedback_type text NOT NULL CHECK (feedback_type IN ('issue', 'suggestion', 'review', 'upgrade')),
  content text,
  screenshot_url text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  status text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Policies for user_feedback
-- Users can insert their own feedback (or anonymous feedback if authenticated without user_id, but here we'll allow insert for authenticated users)
CREATE POLICY "Users can insert feedback" 
  ON public.user_feedback FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Super admins can view all feedback" 
  ON public.user_feedback FOR SELECT 
  TO authenticated 
  USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update feedback status"
  ON public.user_feedback FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Storage bucket for feedback screenshots
INSERT INTO storage.buckets (id, name, public) 
VALUES ('feedback_images', 'feedback_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload feedback images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'feedback_images');

CREATE POLICY "Anyone can view feedback images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'feedback_images');

-- RPC to list feedback for Super Admin
CREATE OR REPLACE FUNCTION public.sa_list_feedback()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  user_email text,
  page_url text,
  feedback_type text,
  content text,
  screenshot_url text,
  rating integer,
  status text,
  created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT f.id, f.user_id, p.email AS user_email, f.page_url, f.feedback_type, f.content, f.screenshot_url, f.rating, f.status, f.created_at
    FROM public.user_feedback f
    LEFT JOIN public.profiles p ON f.user_id = p.id
    ORDER BY f.created_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.sa_update_feedback_status(p_feedback_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin') THEN RETURN jsonb_build_object('ok',false,'error','Not authorized'); END IF;
  UPDATE public.user_feedback SET status = p_status WHERE id = p_feedback_id;
  RETURN jsonb_build_object('ok',true);
END; $$;
