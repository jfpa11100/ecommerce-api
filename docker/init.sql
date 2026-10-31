CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    ship_address TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commerce (
    nit INTEGER PRIMARY KEY,
    legal_name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_number TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(9, 2) NOT NULL,
    amount_available INTEGER DEFAULT 0,
    category TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    commerce_nit INTEGER NOT NULL
        REFERENCES public.commerce(nit)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
);