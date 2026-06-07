-- Enable PostGIS extension (PostgreSQL Spatial Support)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add location geography point column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Create a spatial GIST index on location for high-performance proximity queries
CREATE INDEX IF NOT EXISTS profiles_geo_index ON public.profiles USING GIST (location);

-- Create RPC function to retrieve nearby drinkers excluding the calling user
CREATE OR REPLACE FUNCTION public.get_nearby_drinkers(lat float, lon float, radius_km float)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_urls TEXT[],
  drink_preferences TEXT[],
  intents TEXT[],
  date_of_birth DATE,
  location geography(POINT, 4326),
  distance_meters float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.avatar_urls,
    p.drink_preferences,
    p.intents,
    p.date_of_birth,
    p.location,
    ST_Distance(p.location, ST_MakePoint(lon, lat)::geography) AS distance_meters
  FROM public.profiles p
  WHERE p.id != auth.uid()
    AND p.location IS NOT NULL
    AND ST_DWithin(p.location, ST_MakePoint(lon, lat)::geography, radius_km * 1000)
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
