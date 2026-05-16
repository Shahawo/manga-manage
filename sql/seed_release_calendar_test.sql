-- Seed data: test entries cho tháng 5/2026
-- Chạy trong Supabase SQL Editor để kiểm tra calendar render

INSERT INTO public.release_calendar (release_date, series, title, volume, publisher, price, cover_url, edition) VALUES
('2026-05-07', 'Jujutsu Kaisen', 'Jujutsu Kaisen', 27, 'Kim Đồng', 45000, 'https://m.media-amazon.com/images/I/81iQF49NSEL._AC_UF1000,1000_QL80_.jpg', 'standard'),
('2026-05-07', 'Naruto', 'Naruto', 72, 'Kim Đồng', 45000, 'https://upload.wikimedia.org/wikipedia/vi/9/9d/Naruto_vol72.jpg', 'standard'),
('2026-05-14', 'Spy x Family', 'Spy x Family', 14, 'Kim Đồng', 45000, 'https://m.media-amazon.com/images/I/815UvMtJyGL._AC_UF1000,1000_QL80_.jpg', 'standard'),
('2026-05-14', 'Chainsaw Man', 'Chainsaw Man', 18, 'Trẻ', 55000, 'https://m.media-amazon.com/images/I/81JcGBd0byL._AC_UF1000,1000_QL80_.jpg', 'special'),
('2026-05-14', 'Demon Slayer', 'Kimetsu no Yaiba', 23, 'Kim Đồng', 45000, 'https://m.media-amazon.com/images/I/71XP96L9K9L._AC_UF1000,1000_QL80_.jpg', 'collector'),
('2026-05-21', 'One Piece', 'One Piece', 107, 'Kim Đồng', 49000, 'https://m.media-amazon.com/images/I/71b8yl0yS3L._AC_UF1000,1000_QL80_.jpg', 'standard'),
('2026-05-21', 'Tokyo Revengers', 'Tokyo Revengers', 31, 'Hồng Đức', 42000, NULL, 'standard'),
('2026-05-28', 'Blue Lock', 'Blue Lock', 28, 'Hồng Đức', 42000, 'https://m.media-amazon.com/images/I/81qOF2XsxJL._AC_UF1000,1000_QL80_.jpg', 'standard'),
('2026-05-28', 'Frieren', 'Sousou no Frieren', 13, 'Kim Đồng', 48000, 'https://m.media-amazon.com/images/I/81PL3sZuGvL._AC_UF1000,1000_QL80_.jpg', 'limited'),
('2026-05-28', 'My Hero Academia', 'Boku no Hero Academia', 40, 'Kim Đồng', 45000, 'https://m.media-amazon.com/images/I/81P4vBqxhBL._AC_UF1000,1000_QL80_.jpg', 'standard');
