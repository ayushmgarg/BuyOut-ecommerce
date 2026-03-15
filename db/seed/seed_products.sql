INSERT INTO products (id, name, description, price_cents, total_stock, image_url, sale_starts_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Midnight Edition Sneakers',
    'Limited edition sneakers — only 100 pairs available worldwide.',
    14999,
    100,
    '/images/midnight-sneakers.png',
    now() + INTERVAL '5 minutes'
)
ON CONFLICT (id) DO NOTHING;
