-- Create sports table
CREATE TABLE public.sports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    theme_color TEXT NOT NULL,
    mascot_url TEXT,
    status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'launching', 'dormant')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed sports table
INSERT INTO public.sports (name, theme_color, mascot_url, status) VALUES
('Cricket', '#548c5a', '/assets/child_cricket.png', 'live'),
('Football', '#3e6c99', '/assets/child_football.png', 'live'),
('Pickleball', '#8c4c7a', '/assets/child_pickleball.png', 'live'),
('Badminton', '#bd5353', '/assets/child_badminton.png', 'live'),
('Tennis', '#3e6c99', '/assets/child_football.png', 'launching');

-- Add sport_id to tournaments
ALTER TABLE public.tournaments
ADD COLUMN sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL;

-- If there are existing tournaments, we can set them to 'Cricket' by default to not break existing data
UPDATE public.tournaments 
SET sport_id = (SELECT id FROM public.sports WHERE name = 'Cricket' LIMIT 1)
WHERE sport_id IS NULL;
