-- =====================================================
-- Migration: Master Diagnosa & Master Dosis Obat
-- =====================================================

-- 1. Tabel master diagnosa (menggantikan sheetbantu untuk diagnosa)
CREATE TABLE IF NOT EXISTS public.diagnosa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel master dosis / aturan pakai obat
CREATE TABLE IF NOT EXISTS public.dosis_obat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT NOT NULL UNIQUE,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Populate initial standard diagnosa from Excel klinik
INSERT INTO public.diagnosa (nama) VALUES
    ('Commond Cold'), ('Faringitis'), ('Vertigo'), ('Strain'), ('Chepalgia'),
    ('Unspesified Disorder'), ('Gastritis'), ('Unspesified Allergy'), ('Hipertermia'),
    ('Odontalgia'), ('Hipertensi'), ('Myalgia'), ('Diarhea'), ('Gerd'), ('Contusion'),
    ('Hiperuricemia'), ('Disminorhea'), ('Unspesified Infection'), ('Pulpitis'),
    ('Vomiting'), ('Vulnus Laceratum'), ('Hiperlipidemia'), ('Hordeulum'), ('Stomatitis'),
    ('Artritis'), ('Diabetes Mellitus'), ('Dermatitis'), ('Tinea'), ('Konjungtivitis'),
    ('Toothache'), ('Trauma Okuli'), ('Vulnus Contussum'), ('Hipotension'), ('Migrain'),
    ('Hipoxia'), ('Combustio'), ('Keratitis'), ('Gingivitis'), ('Herpes Zoster'),
    ('Leukositosis'), ('Osteoarthitis'), ('Pra-Hipertensi'), ('Tachicardia')
ON CONFLICT (nama) DO NOTHING;

-- 4. Populate initial standard dosis
INSERT INTO public.dosis_obat (kode, keterangan) VALUES
    ('3DD1', '3 x 1 hari'),
    ('2DD1', '2 x 1 hari'),
    ('1DD1', '1 x 1 hari'),
    ('4DD1', '4 x 1 hari'),
    ('2TAB/BAB', '2 tablet setiap buang air besar'),
    ('K/P', 'Bila perlu / sesak / nyeri'),
    ('Q4H', 'Tiap 4 jam'),
    ('4QH', 'Tiap 4 jam'),
    ('1x1 Sesudah Makan', '1 x sehari sesudah makan'),
    ('2x1 Sesudah Makan', '2 x sehari sesudah makan'),
    ('3x1 Sesudah Makan', '3 x sehari sesudah makan')
ON CONFLICT (kode) DO NOTHING;
