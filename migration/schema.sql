-- โครงสร้างข้อมูลเว็บใหม่ "ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด" (PostgreSQL)
-- ออกแบบจากข้อมูลจริงของ 76 ไซต์เดิม: เอกสาร 2,968 รายการ, แดชบอร์ด 559 รายการ, ปีงบประมาณ 2565-2570

-- ───────────── ข้อมูลอ้างอิง (ส่วนกลางดูแล) ─────────────

-- ธีมสีสำเร็จรูปให้จังหวัดเลือก (ไม่เปิดให้เลือกสีอิสระ เพื่อรับประกันว่าตัวหนังสืออ่านออกทุกธีม)
CREATE TABLE themes (
    code          text PRIMARY KEY,
    name_th       text NOT NULL,
    primary_color text NOT NULL,                 -- ปุ่ม ลิงก์ แถบเมนูที่เลือก
    dark_color    text NOT NULL,                 -- พื้นส่วนหัว สีทับภาพเด่น (ตัวหนังสือขาวต้องอ่านออก)
    tint_color    text NOT NULL,                 -- พื้นอ่อนของปุ่มที่เลือกและป้าย
    sort_order    smallint NOT NULL DEFAULT 0
);

INSERT INTO themes (code, name_th, primary_color, dark_color, tint_color, sort_order) VALUES
    ('ocean',  'น้ำเงินทะเล', '#0B5A7D', '#083F58', '#E6F0F5', 10),
    ('forest', 'เขียวป่า',    '#1F6B3A', '#154D29', '#E6F2EA', 20),
    ('silk',   'ม่วงผ้าไหม',  '#6D46A8', '#4A2E7A', '#EFE9F7', 30),
    ('lac',    'แดงครั่ง',    '#9A2B1F', '#701D14', '#F7E8E6', 40),
    ('brick',  'ส้มอิฐ',      '#B4510E', '#8A3A08', '#FBE9DD', 50),
    ('gold',   'น้ำตาลทอง',   '#8A6410', '#634708', '#F6EFDC', 60),
    ('lotus',  'ชมพูบัว',     '#A8326B', '#7A214C', '#F8E7EF', 70),
    ('slate',  'เทาคราม',     '#3B4854', '#232D36', '#EEF1F4', 80);

CREATE TABLE provinces (
    id            smallserial PRIMARY KEY,
    slug          text NOT NULL UNIQUE,          -- คงค่าเดิม เช่น 'smprakan' เพื่อให้ URL เดิมใช้ต่อได้
    code          char(3) NOT NULL UNIQUE,       -- รหัสย่อจังหวัด เช่น 'SPK' (ตรงกับชื่อไฟล์ตราจังหวัด)
    logo_path     text,                          -- ตราประจำจังหวัด เช่น 'logos/SPK.png' (ไฟล์คงที่ของระบบ)
    name_th       text NOT NULL,
    name_en       text,
    region        text,                          -- ภาค ใช้กรองในหน้ารวมประเทศ
    ckan_url      text NOT NULL,                 -- https://samutprakan.gdcatalog.go.th
    office_name   text,                          -- สำนักงานสถิติจังหวัด...
    address       text,
    phone         text,
    fax           text,
    email         text,
    website       text,
    map_embed_url text
);

CREATE TABLE fiscal_years (
    year        smallint PRIMARY KEY,            -- พ.ศ. เช่น 2569
    is_current  boolean NOT NULL DEFAULT false,  -- ปีที่แสดงเป็นค่าเริ่มต้นหน้าเว็บ
    is_open     boolean NOT NULL DEFAULT true    -- ปิดแล้วจังหวัดแก้ไขไม่ได้
);

-- ประเภทเอกสาร: แทนการพิมพ์ชื่อเองแบบเว็บเดิม
CREATE TABLE document_types (
    code              text PRIMARY KEY,
    name_th           text NOT NULL,
    section           text NOT NULL CHECK (section IN ('meeting', 'analysis')),  -- หมวด 3 / หมวด 4 ของเว็บเดิม
    has_meeting_no    boolean NOT NULL DEFAULT false,   -- ต้องกรอก "ครั้งที่ x/ปี"
    has_topic         boolean NOT NULL DEFAULT false,   -- ต้องเลือกประเด็น
    sort_order        smallint NOT NULL DEFAULT 0
);

INSERT INTO document_types (code, name_th, section, has_meeting_no, has_topic, sort_order) VALUES
    ('committee_order',     'คำสั่งแต่งตั้งคณะกรรมการระดับจังหวัด',   'meeting',  false, false, 10),
    ('meeting_report',      'รายงานการประชุมคณะกรรมการระดับจังหวัด', 'meeting',  true,  false, 20),
    ('meeting_material',    'เอกสารประกอบการประชุม',                      'meeting',  true,  false, 30),
    ('stat_plan',           'แผนพัฒนาสถิติระดับจังหวัด',                   'meeting',  false, false, 40),
    ('official_stat_list',  'บัญชีสถิติทางการระดับพื้นที่',                 'meeting',  false, false, 50),
    ('template1_dataset',   'Template 1 ชุดข้อมูล',                        'meeting',  false, true,  60),
    ('template2_metadata',  'Template 2 คำอธิบายชุดข้อมูล (Metadata)',     'meeting',  false, true,  70),
    ('template3_resource',  'Template 3 ทรัพยากรข้อมูล (Resource)',        'meeting',  false, true,  80),
    ('digital_catalog',     'บัญชีข้อมูลดิจิทัล',                           'meeting',  false, false, 90),
    ('analysis_spec',       'ข้อกำหนดการวิเคราะห์',                        'analysis', false, true,  100),   -- รวมบทวิเคราะห์ประเด็นสำคัญ
    ('other',               'อื่นๆ',                                       'meeting',  false, false, 999);

-- ประเด็นการพัฒนา: ใช้ร่วมกันทั้งเอกสารและแดชบอร์ด ทำให้กรองข้ามจังหวัดได้
CREATE TABLE topics (
    id       smallserial PRIMARY KEY,
    slug     text NOT NULL UNIQUE,
    name_th  text NOT NULL
);

INSERT INTO topics (slug, name_th) VALUES
    ('disaster', 'สาธารณภัย'), ('water', 'การบริหารจัดการน้ำ'), ('waste', 'ขยะ'),
    ('elderly', 'ผู้สูงอายุ'), ('agriculture', 'เกษตร'), ('tourism', 'ท่องเที่ยว'),
    ('economy', 'เศรษฐกิจและรายได้'), ('health', 'สุขภาพและมลพิษอากาศ'), ('safety', 'ความปลอดภัย'),
    ('education', 'การศึกษาและเยาวชน'), ('environment', 'ทรัพยากรธรรมชาติและสิ่งแวดล้อม'),
    ('province_overview', 'ภาพรวมและตัวชี้วัดจังหวัด'), ('other', 'อื่นๆ');

-- ───────────── ผู้ใช้และสิทธิ์ ─────────────

-- บทบาท:
--   admin            ผู้ดูแลระบบส่วนกลาง: ทุกจังหวัด เนื้อหากลาง ส่วนท้าย ธีม นโยบาย และผู้ใช้ทั้งหมด
--   province_manager ผู้ดูแลจังหวัด: เนื้อหาและการปรับแต่งของจังหวัดตัวเอง + เชิญ/ระงับเจ้าหน้าที่ในจังหวัดตัวเอง
--   province_editor  เจ้าหน้าที่จังหวัด: เนื้อหาของจังหวัดตัวเองเท่านั้น
-- ไม่มีการสมัครเอง และระบบไม่ส่งอีเมล (ไม่มี mail server): ผู้ดูแลสร้างบัญชีหรือนำเข้าจาก Excel
-- แล้วระบบออกลิงก์เปิดใช้บัญชีแบบใช้ครั้งเดียวให้ผู้ดูแลนำไปส่งให้เจ้าตัวเอง
CREATE TABLE users (
    id                  serial PRIMARY KEY,
    username            text NOT NULL UNIQUE             -- ใช้เข้าสู่ระบบ: a-z 0-9 . _ - ยาว 4-32 ตัว เก็บเป็นตัวพิมพ์เล็ก
                        CHECK (username ~ '^[a-z0-9][a-z0-9._-]{3,31}$'),
    email               text UNIQUE,                     -- ไม่บังคับ เป็นข้อมูลติดต่อเท่านั้น
    name                text NOT NULL,
    position            text,                            -- ตำแหน่ง
    phone               text,
    password_hash       text,                            -- NULL จนกว่าเจ้าของบัญชีจะเปิดลิงก์และตั้งรหัสผ่านเอง
    role                text NOT NULL CHECK (role IN ('admin', 'province_manager', 'province_editor')),
    status              text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
    suspended_reason    text,                            -- เช่น 'ย้ายหน่วยงาน', 'ไม่ได้ใช้งานเกิน 180 วัน'
    -- การยืนยันตัวตนสองขั้น (2FA) บังคับทุกบัญชี: เข้าสู่ระบบ = username + รหัสผ่าน + รหัส 6 หลักจากแอป
    totp_secret         text,                            -- เข้ารหัสก่อนเก็บ; NULL = ยังไม่ได้ตั้งค่า ต้องตั้งในการเข้าสู่ระบบครั้งแรก
    totp_confirmed_at   timestamptz,                     -- ตั้งค่าสำเร็จเมื่อใด; ผู้ดูแลรีเซ็ตได้ (กลับเป็น NULL) เมื่อผู้ใช้เปลี่ยนหรือทำโทรศัพท์หาย
    failed_logins       smallint NOT NULL DEFAULT 0,     -- ผิดครบ 5 ครั้ง → ล็อก 15 นาที
    locked_until        timestamptz,
    password_changed_at timestamptz,
    last_login_at       timestamptz,
    created_by          int REFERENCES users,
    import_batch_id     int,                             -- อ้างถึง user_import_batches เมื่อสร้างจากการนำเข้า Excel
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ลิงก์ใช้ครั้งเดียวที่ผู้ดูแลออกให้: เปิดใช้บัญชีครั้งแรก (อายุ 14 วัน) และตั้งรหัสผ่านใหม่ (อายุ 24 ชั่วโมง)
-- ระบบแสดงลิงก์ให้ผู้ดูแลครั้งเดียวตอนออก แล้วเก็บเฉพาะค่า hash ออกใหม่ได้ ลิงก์เก่าจะใช้ไม่ได้ทันที
CREATE TABLE user_tokens (
    id          serial PRIMARY KEY,
    user_id     int NOT NULL REFERENCES users ON DELETE CASCADE,
    purpose     text NOT NULL CHECK (purpose IN ('activation', 'password_reset')),
    token_hash  char(64) NOT NULL UNIQUE,                -- เก็บเฉพาะค่า hash ของโทเคน
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_by  int REFERENCES users,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- การนำเข้าผู้ใช้จากไฟล์ Excel: ตรวจทุกแถวและแสดงผลก่อน สร้างบัญชีเมื่อผู้ดูแลกดยืนยัน
CREATE TABLE user_import_batches (
    id             serial PRIMARY KEY,
    file_name      text NOT NULL,
    total_rows     int NOT NULL,
    created_count  int NOT NULL DEFAULT 0,
    skipped_count  int NOT NULL DEFAULT 0,           -- แถวที่ไม่ผ่านการตรวจ
    errors         jsonb,                            -- [{row, column, message}]
    status         text NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed', 'confirmed', 'cancelled')),
    created_by     int NOT NULL REFERENCES users,
    created_at     timestamptz NOT NULL DEFAULT now(),
    confirmed_at   timestamptz
);
ALTER TABLE users ADD FOREIGN KEY (import_batch_id) REFERENCES user_import_batches;

-- รหัสสำรอง 10 ชุด ใช้แทนรหัส 2FA ได้ชุดละครั้ง กรณีไม่มีโทรศัพท์อยู่กับตัว
CREATE TABLE user_recovery_codes (
    id          serial PRIMARY KEY,
    user_id     int NOT NULL REFERENCES users ON DELETE CASCADE,
    code_hash   char(64) NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ประวัติการเข้าสู่ระบบ (สำเร็จและไม่สำเร็จ) เก็บ 1 ปี
CREATE TABLE login_events (
    id          bigserial PRIMARY KEY,
    user_id     int REFERENCES users ON DELETE SET NULL,
    username    text NOT NULL,                           -- ชื่อผู้ใช้ที่พยายามใช้ แม้ไม่มีบัญชี
    success     boolean NOT NULL,
    reason      text,                                    -- 'wrong_password', 'locked', 'suspended', 'totp_failed'
    ip_address  inet,
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_user ON login_events (user_id, created_at DESC);

-- province_manager / province_editor ทำงานได้เฉพาะจังหวัดที่ผูกไว้ (admin ไม่ต้องมีแถวในตารางนี้)
-- ย้ายจังหวัด = เปลี่ยนแถวในตารางนี้ เนื้อหาที่เคยลงยังอยู่กับจังหวัดเดิม
CREATE TABLE user_provinces (
    user_id      int NOT NULL REFERENCES users ON DELETE CASCADE,
    province_id  smallint NOT NULL REFERENCES provinces,
    PRIMARY KEY (user_id, province_id)
);

-- ───────────── ไฟล์ ─────────────

-- ไฟล์ทุกไฟล์อยู่ตารางเดียว เอกสาร/แดชบอร์ด/เนื้อหากลางอ้างถึงผ่านตารางเชื่อม
CREATE TABLE files (
    id             serial PRIMARY KEY,
    storage_key    text NOT NULL UNIQUE,         -- ตำแหน่งจริงในที่เก็บไฟล์ เช่น 'smprakan/2569/xxxx.pdf'
    original_name  text NOT NULL,
    mime_type      text NOT NULL,
    size_bytes     bigint NOT NULL,
    sha256         char(64) NOT NULL,            -- ตรวจความครบถ้วนตอนย้าย และกันอัปโหลดซ้ำ
    legacy_url     text UNIQUE,                  -- URL เดิม ใช้สร้าง redirect
    uploaded_by    int REFERENCES users,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ประวัติการแก้ไขไฟล์: เมื่ออัปโหลดไฟล์ใหม่แทนไฟล์เดิม ไฟล์เดิมไม่ถูกลบ
--   ไฟล์ใหม่ = แถวใหม่ที่ is_current = true, รับ public_path ต่อจากไฟล์เดิม (ลิงก์เดิมจึงชี้ไฟล์ล่าสุดเสมอ)
--   ไฟล์เดิม = is_current = false, เปิดดูและกู้คืนได้จากหลังบ้านเท่านั้น
ALTER TABLE files
    ADD COLUMN public_path       text,                       -- path ที่เปิดจากหน้าเว็บ เช่น 'uploads/content/smprakan/file01_20220527040401.pdf'
    ADD COLUMN is_current        boolean NOT NULL DEFAULT true,
    ADD COLUMN version_no        int NOT NULL DEFAULT 1,     -- 1 = ไฟล์แรก, เพิ่มทีละ 1 ทุกครั้งที่แทนที่
    ADD COLUMN replaces_file_id  int REFERENCES files,       -- ไฟล์ก่อนหน้าที่ไฟล์นี้มาแทน
    ADD COLUMN change_note       text,                       -- เหตุผลที่แก้ไข (ผู้อัปโหลดกรอก)
    ADD COLUMN replaced_at       timestamptz,                -- เวลาที่ไฟล์นี้ถูกแทนที่
    ADD COLUMN replaced_by       int REFERENCES users;       -- ผู้ที่อัปโหลดไฟล์มาแทน
CREATE UNIQUE INDEX files_public_path_current ON files (public_path) WHERE is_current;
CREATE INDEX files_history ON files (replaces_file_id);

-- การปรับแต่งหน้าเว็บที่จังหวัดแก้เองได้จากหลังบ้าน
ALTER TABLE provinces
    ADD COLUMN theme_code      text NOT NULL DEFAULT 'ocean' REFERENCES themes,
    ADD COLUMN hero_image_id   int REFERENCES files,          -- ภาพเด่นส่วนหัว (12:5, แนะนำ 2400x1000); NULL = พื้นสีธีม + ตราจังหวัด
    ADD COLUMN hero_focus_x    smallint NOT NULL DEFAULT 50 CHECK (hero_focus_x BETWEEN 0 AND 100),  -- จุดเด่นของภาพ (%) ใช้ตอนตัดภาพบนจอแคบ
    ADD COLUMN hero_focus_y    smallint NOT NULL DEFAULT 50 CHECK (hero_focus_y BETWEEN 0 AND 100),
    ADD COLUMN hero_text_side  text NOT NULL DEFAULT 'left' CHECK (hero_text_side IN ('left', 'right')),  -- ข้อความทับภาพฝั่งใด
    ADD COLUMN hero_credit     text;                          -- ที่มาของภาพ / หมายเหตุว่าเป็นภาพสร้างด้วย AI

-- ───────────── เนื้อหาที่จังหวัดลงเอง ─────────────

CREATE TABLE documents (
    id            serial PRIMARY KEY,
    province_id   smallint NOT NULL REFERENCES provinces,
    fiscal_year   smallint NOT NULL REFERENCES fiscal_years,
    type_code     text NOT NULL REFERENCES document_types,
    topic_id      smallint REFERENCES topics,
    title         text NOT NULL,                 -- ระบบเสนอชื่อมาตรฐานจากประเภท+ครั้งที่ แก้ไขได้
    description   text,
    issue_title   text,                          -- ประเด็นการพัฒนาของจังหวัดที่เอกสารนี้สังกัด เช่น 'การพัฒนาศักยภาพมะม่วงน้ำดอกไม้สู่สากล'
    external_url  text,                          -- กรณีเอกสารเป็นลิงก์ภายนอกแทนไฟล์ (เว็บเดิมมีบางรายการ)
    meeting_no    smallint,                      -- ครั้งที่ (ของปีงบประมาณนั้น)
    meeting_date  date,
    sort_order    int NOT NULL DEFAULT 0,
    status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at  timestamptz,
    created_by    int REFERENCES users,
    updated_by    int REFERENCES users,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    -- ร่องรอยจากเว็บเดิม
    legacy_id       int UNIQUE,                  -- เลข item-NNNNN เดิม ใช้ redirect anchor และตรวจสอบการย้าย
    legacy_title    text,                        -- ชื่อเดิมก่อนจัดมาตรฐาน
    needs_review    boolean NOT NULL DEFAULT false   -- จัดประเภทอัตโนมัติไม่ได้ ให้คนตรวจ
);
CREATE INDEX documents_listing ON documents (province_id, fiscal_year, type_code) WHERE status = 'published';

CREATE TABLE document_files (
    document_id  int NOT NULL REFERENCES documents ON DELETE CASCADE,
    file_id      int NOT NULL REFERENCES files,
    sort_order   smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (document_id, file_id)
);

CREATE TABLE dashboards (
    id             serial PRIMARY KEY,
    province_id    smallint NOT NULL REFERENCES provinces,
    fiscal_year    smallint NOT NULL REFERENCES fiscal_years,
    topic_id       smallint REFERENCES topics,
    title          text NOT NULL,
    description    text,
    provider       text NOT NULL DEFAULT 'powerbi' CHECK (provider IN ('powerbi', 'arcgis', 'looker', 'other', 'none')),
    embed_url      text,                         -- NULL ได้เมื่อ provider = 'none' (มีแต่ไฟล์แนบ)
    thumbnail_id   int REFERENCES files,         -- ภาพตัวอย่างบนการ์ด โหลด iframe เมื่อผู้ใช้เปิดดูเท่านั้น
    is_featured    boolean NOT NULL DEFAULT false,
    sort_order     int NOT NULL DEFAULT 0,
    status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at   timestamptz,
    link_ok        boolean,                      -- ผลตรวจลิงก์อัตโนมัติล่าสุด
    link_checked_at timestamptz,
    created_by     int REFERENCES users,
    updated_by     int REFERENCES users,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    legacy_id      int UNIQUE,
    legacy_title   text,
    needs_review   boolean NOT NULL DEFAULT false
);
CREATE INDEX dashboards_listing ON dashboards (province_id, fiscal_year) WHERE status = 'published';
CREATE INDEX dashboards_by_topic ON dashboards (topic_id, fiscal_year) WHERE status = 'published';

CREATE TABLE dashboard_files (                   -- เอกสารประกอบแดชบอร์ด (เว็บเดิมมีบางรายการ)
    dashboard_id  int NOT NULL REFERENCES dashboards ON DELETE CASCADE,
    file_id       int NOT NULL REFERENCES files,
    sort_order    smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (dashboard_id, file_id)
);

-- ถังขยะ: ลบแล้วกู้คืนได้ 30 วัน (ไฟล์ยังอยู่ครบ) หลังจากนั้น admin ส่วนกลางเท่านั้นที่ลบถาวรได้
ALTER TABLE documents  ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by int REFERENCES users;
ALTER TABLE dashboards ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by int REFERENCES users;

-- ───────────── เนื้อหากลาง (แก้ครั้งเดียว แสดงทุกจังหวัด) ─────────────

CREATE TABLE central_contents (
    id           serial PRIMARY KEY,
    section      text NOT NULL CHECK (section IN ('plan', 'howto')),   -- หมวด 1 แผนขับเคลื่อน / หมวด 2 เทคนิคการขึ้นชุดข้อมูล
    fiscal_year  smallint REFERENCES fiscal_years,                     -- NULL = ใช้ทุกปี
    slug         text NOT NULL,
    title        text NOT NULL,
    body         text,                           -- rich text
    source_url   text,                           -- "ที่มา" ของเนื้อหา
    sort_order   int NOT NULL DEFAULT 0,
    status       text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    updated_by   int REFERENCES users,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (section, fiscal_year, slug)
);

CREATE TABLE central_content_files (
    content_id  int NOT NULL REFERENCES central_contents ON DELETE CASCADE,
    file_id     int NOT NULL REFERENCES files,
    sort_order  smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (content_id, file_id)
);

CREATE TABLE central_content_links (             -- รายการลิงก์แบบมีลำดับ เช่น "บทความสั้น 12 เรื่อง"
    id          serial PRIMARY KEY,
    content_id  int NOT NULL REFERENCES central_contents ON DELETE CASCADE,
    title       text NOT NULL,
    url         text,                            -- ลิงก์ภายนอก (เช่น หน้า gdhelppage)
    file_id     int REFERENCES files,            -- หรือไฟล์ที่เก็บในระบบ
    sort_order  int NOT NULL DEFAULT 0,
    CHECK (url IS NOT NULL OR file_id IS NOT NULL)
);

-- ───────────── ส่วนท้ายของหน้าเว็บ (ส่วนกลางจัดการ ใช้ร่วมทุกจังหวัด) ─────────────
-- ส่วนที่ต่างกันรายจังหวัด (ชื่อสำนักงาน ที่อยู่ โทรศัพท์ อีเมล ตรา) มาจากตาราง provinces

CREATE TABLE site_settings (                     -- มีแถวเดียว
    id                 boolean PRIMARY KEY DEFAULT true CHECK (id),
    site_name          text NOT NULL DEFAULT 'ระบบสนับสนุนการจัดทำบัญชีข้อมูล',
    copyright_text     text NOT NULL DEFAULT 'สำนักงานสถิติแห่งชาติ',   -- แสดงต่อจาก "© ปี"
    footer_note        text,                     -- ข้อความเสริมท้ายหน้า (ไม่บังคับ)
    show_staff_login   boolean NOT NULL DEFAULT true,
    show_map_link      boolean NOT NULL DEFAULT true,
    show_visit_stats   boolean NOT NULL DEFAULT true,   -- แสดงสถิติการเข้าชมในส่วนท้าย
    stats_since        date,                            -- วันที่เริ่มนับ (วันเปิดระบบ)
    updated_by         int REFERENCES users,
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE footer_groups (                     -- คอลัมน์ลิงก์ในส่วนท้าย เช่น "เมนู", "หน่วยงานที่เกี่ยวข้อง"
    id          serial PRIMARY KEY,
    title       text NOT NULL,
    sort_order  int NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE footer_links (
    id          serial PRIMARY KEY,
    group_id    int NOT NULL REFERENCES footer_groups ON DELETE CASCADE,
    title       text NOT NULL,                   -- ใช้ {province} แทนชื่อจังหวัดได้
    -- ปลายทาง: ลิงก์ภายนอก หรือหน้าในระบบ ('home','docs','utilization','ckan','privacy-policy','cookie-policy','cookie-settings')
    url         text,
    internal    text,
    sort_order  int NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    CHECK ((url IS NULL) <> (internal IS NULL))
);

-- สถิติการเข้าชม: นับจำนวนครั้งที่เปิดหน้า (page view) ฝั่งเซิร์ฟเวอร์ รวมเป็นรายวันต่อจังหวัด
-- ไม่เก็บ IP ไม่ใช้คุกกี้ ไม่ระบุตัวบุคคล จึงนับได้โดยไม่ต้องขอความยินยอม; ไม่นับโปรแกรมอัตโนมัติ (bot) และผู้ที่ล็อกอินหลังบ้าน
CREATE TABLE page_views_daily (
    province_id  smallint NOT NULL REFERENCES provinces,
    view_date    date NOT NULL,
    page         text NOT NULL CHECK (page IN ('home', 'docs', 'utilization', 'other')),
    views        int NOT NULL DEFAULT 0,
    PRIMARY KEY (province_id, view_date, page)
);
-- ยอดดาวน์โหลดต่อไฟล์ ใช้ในหลังบ้าน (เอกสารใดถูกเปิดมาก)
ALTER TABLE files ADD COLUMN download_count int NOT NULL DEFAULT 0;

-- ───────────── ประกาศป๊อปอัปและโหมดไว้ทุกข์ (admin ส่วนกลางจัดการ) ─────────────

CREATE TABLE announcements (
    id             serial PRIMARY KEY,
    title          text NOT NULL,
    body           text,
    image_id       int REFERENCES files,             -- แนะนำ 1240x520
    image_alt      text,                             -- คำอธิบายภาพ บังคับเมื่อมีภาพ
    button_label   text,
    button_url     text,
    starts_at      timestamptz NOT NULL,
    ends_at        timestamptz,                      -- พ้นเวลานี้หยุดแสดงเอง
    all_provinces  boolean NOT NULL DEFAULT true,    -- false = เฉพาะจังหวัดใน announcement_provinces
    show_on        text NOT NULL DEFAULT 'home' CHECK (show_on IN ('home', 'all')),
    frequency      text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('once', 'daily', 'always')),
    status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'stopped')),
    priority       int NOT NULL DEFAULT 0,           -- ถ้าช่วงเวลาซ้อนกัน แสดงรายการที่ค่าสูงสุดรายการเดียว
    created_by     int REFERENCES users,
    updated_by     int REFERENCES users,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (image_id IS NULL OR image_alt IS NOT NULL),
    CHECK (body IS NOT NULL OR image_id IS NOT NULL)
);

CREATE TABLE announcement_provinces (
    announcement_id  int NOT NULL REFERENCES announcements ON DELETE CASCADE,
    province_id      smallint NOT NULL REFERENCES provinces,
    PRIMARY KEY (announcement_id, province_id)
);

-- โหมดไว้ทุกข์: หน้าเว็บทุกจังหวัดเป็นโทนขาวดำ พร้อมริบบิ้นสีดำที่มุมบน
ALTER TABLE site_settings
    ADD COLUMN mourning_enabled        boolean NOT NULL DEFAULT false,
    ADD COLUMN mourning_starts_on      date,
    ADD COLUMN mourning_ends_on        date,                          -- พ้นวันนี้ปิดเอง; NULL = จนกว่าจะปิดด้วยมือ
    ADD COLUMN mourning_grayscale      boolean NOT NULL DEFAULT true,
    ADD COLUMN mourning_ribbon         boolean NOT NULL DEFAULT true,
    ADD COLUMN mourning_ribbon_corner  text NOT NULL DEFAULT 'top-left' CHECK (mourning_ribbon_corner IN ('top-left', 'top-right')),
    ADD COLUMN mourning_keep_embeds    boolean NOT NULL DEFAULT false, -- คงสีของแดชบอร์ดที่ฝังไว้
    ADD COLUMN mourning_message        text;

-- ───────────── คุกกี้และความเป็นส่วนตัว (PDPA) ─────────────

-- หน้านโยบายที่ส่วนกลางแก้ไขได้ ใช้ร่วมทุกจังหวัด
CREATE TABLE site_pages (
    slug        text PRIMARY KEY,                -- 'privacy-policy', 'cookie-policy'
    title       text NOT NULL,
    body        text NOT NULL,                   -- rich text
    version     int NOT NULL DEFAULT 1,          -- เพิ่มเลขเมื่อแก้สาระสำคัญ → แถบคุกกี้ขอความยินยอมใหม่
    updated_by  int REFERENCES users,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- หลักฐานการให้ความยินยอม เก็บแบบไม่ระบุตัวบุคคล (ไม่เก็บ IP เต็ม ไม่ผูกกับบัญชีผู้ใช้)
CREATE TABLE cookie_consents (
    id              bigserial PRIMARY KEY,
    visitor_id      uuid NOT NULL,               -- สุ่มสร้างในเบราว์เซอร์ เก็บในคุกกี้ความยินยอม
    policy_version  int NOT NULL,
    analytics       boolean NOT NULL,            -- ยินยอมคุกกี้สถิติการใช้งาน
    third_party     boolean NOT NULL,            -- ยินยอมเนื้อหาฝังจากภายนอก (Power BI, Google Maps)
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cookie_consents_visitor ON cookie_consents (visitor_id, created_at DESC);

-- ───────────── ติดตามความครบถ้วนและประวัติ ─────────────

CREATE TABLE audit_logs (
    id          bigserial PRIMARY KEY,
    user_id     int REFERENCES users,
    action      text NOT NULL,                   -- create / update / publish / delete / login
    entity      text NOT NULL,                   -- documents / dashboards / ...
    entity_id   int,
    changes     jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity ON audit_logs (entity, entity_id);
