-- Migration 129: Seed 10 realistic test customers
-- All records carry is_test = true and will be excluded from production reporting.
-- UUID scheme: 00000000-0000-0000-TTTT-NNNNNNNNNNNN
--   0001=customer  0002=quote   0003=order   0004=lead
--   0005=lead_conv 0006=rating  0007=conversation 0008=message
--
-- Scenarios:
--   Sarah Thompson   - fortnightly cleaning, Springwood (quoted, scheduled)
--   Michael Davies   - lawn mowing, Underwood (completed, 5★ review)
--   Emma Wilson      - window cleaning, Sunnybank Hills (awaiting response)
--   James O'Brien    - end of lease, Loganlea (completed, 4★ review)
--   Lisa Chang       - fortnightly cleaning, Beenleigh (in progress)
--   Robert Martinez  - car detailing, Eight Mile Plains (cold lead)
--   Kylie Anderson   - deep house clean, Rochedale South (completed, 5★ review)
--   David Nguyen     - dump run, Slacks Creek (pending payment)
--   Melissa Patel    - NDIS domestic assistance, Waterford West (in conversation)
--   Tom Wilson       - commercial cleaning, Meadowbrook (completed, 4★ review)

INSERT INTO customers (id, full_name, email, phone, region, default_address, is_test, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001','Sarah Thompson',  'sarah.thompson.test@budstest.dev',  '0412 000 001','Logan',          '14 Hillcrest Ave, Springwood QLD 4127',            true, NOW()-INTERVAL '30 days'),
  ('00000000-0000-0000-0001-000000000002','Michael Davies',  'michael.davies.test@budstest.dev',  '0412 000 002','Logan',          '7 Warrego Cres, Underwood QLD 4119',               true, NOW()-INTERVAL '45 days'),
  ('00000000-0000-0000-0001-000000000003','Emma Wilson',     'emma.wilson.test@budstest.dev',     '0412 000 003','Brisbane South', '22 Sunbury Rd, Sunnybank Hills QLD 4109',          true, NOW()-INTERVAL '7 days'),
  ('00000000-0000-0000-0001-000000000004','James O''Brien',  'james.obrien.test@budstest.dev',    '0412 000 004','Logan',          '3 Regent St, Loganlea QLD 4131',                   true, NOW()-INTERVAL '60 days'),
  ('00000000-0000-0000-0001-000000000005','Lisa Chang',      'lisa.chang.test@budstest.dev',      '0412 000 005','Logan',          '41 Beenleigh-Redland Bay Rd, Beenleigh QLD 4207',  true, NOW()-INTERVAL '20 days'),
  ('00000000-0000-0000-0001-000000000006','Robert Martinez', 'robert.martinez.test@budstest.dev', '0412 000 006','Brisbane South', '18 Corporate Dr, Eight Mile Plains QLD 4113',      true, NOW()-INTERVAL '5 days'),
  ('00000000-0000-0000-0001-000000000007','Kylie Anderson',  'kylie.anderson.test@budstest.dev',  '0412 000 007','Logan',          '9 Rochedale Rd, Rochedale South QLD 4123',         true, NOW()-INTERVAL '55 days'),
  ('00000000-0000-0000-0001-000000000008','David Nguyen',    'david.nguyen.test@budstest.dev',    '0412 000 008','Logan',          '56 Kingston Rd, Slacks Creek QLD 4127',            true, NOW()-INTERVAL '10 days'),
  ('00000000-0000-0000-0001-000000000009','Melissa Patel',   'melissa.patel.test@budstest.dev',   '0412 000 009','Logan',          '88 Waterford Rd, Waterford West QLD 4133',         true, NOW()-INTERVAL '15 days'),
  ('00000000-0000-0000-0001-00000000000a','Tom Wilson',      'tom.wilson.test@budstest.dev',      '0412 000 010','Logan',          '2 Enterprise Ave, Meadowbrook QLD 4131',           true, NOW()-INTERVAL '50 days')
ON CONFLICT (id) DO NOTHING;

-- quotes.customer_id is an auth.users FK — omitted for test records
INSERT INTO quotes (id, customer_name, customer_email, customer_phone,
  service_type, context, frequency, scope, total, submitted_total, reviewed_total,
  status, payment_status, service_address, is_test, created_at, finalized_at) VALUES
  ('00000000-0000-0000-0002-000000000001','Sarah Thompson','sarah.thompson.test@budstest.dev','0412 000 001',
   'cleaning','home','fortnightly','3-bed house, standard clean',220,220,220,'finalized','not_requested',
   '14 Hillcrest Ave, Springwood QLD 4127',true, NOW()-INTERVAL '28 days', NOW()-INTERVAL '25 days'),
  ('00000000-0000-0000-0002-000000000002','Michael Davies','michael.davies.test@budstest.dev','0412 000 002',
   'lawn-mowing','home','none','Front and back lawn, 600sqm, edging included',120,120,120,'finalized','paid',
   '7 Warrego Cres, Underwood QLD 4119',true, NOW()-INTERVAL '40 days', NOW()-INTERVAL '38 days'),
  ('00000000-0000-0000-0002-000000000003','Emma Wilson','emma.wilson.test@budstest.dev','0412 000 003',
   'windows','home','none','2-storey home, 14 windows inside and out',280,280,NULL,'submitted','not_requested',
   '22 Sunbury Rd, Sunnybank Hills QLD 4109',true, NOW()-INTERVAL '6 days', NULL),
  ('00000000-0000-0000-0002-000000000004','James O''Brien','james.obrien.test@budstest.dev','0412 000 004',
   'end-of-lease','home','none','3-bed 2-bath unit, oven, carpet steam clean',420,420,420,'finalized','paid',
   '3 Regent St, Loganlea QLD 4131',true, NOW()-INTERVAL '58 days', NOW()-INTERVAL '55 days'),
  ('00000000-0000-0000-0002-000000000005','Lisa Chang','lisa.chang.test@budstest.dev','0412 000 005',
   'cleaning','home','fortnightly','4-bed house, full clean',185,185,185,'finalized','paid',
   '41 Beenleigh-Redland Bay Rd, Beenleigh QLD 4207',true, NOW()-INTERVAL '18 days', NOW()-INTERVAL '16 days'),
  ('00000000-0000-0000-0002-000000000006','Robert Martinez','robert.martinez.test@budstest.dev','0412 000 006',
   'car-detailing','home','none','Full interior/exterior detail, Toyota Landcruiser',195,195,NULL,'submitted','not_requested',
   '18 Corporate Dr, Eight Mile Plains QLD 4113',true, NOW()-INTERVAL '4 days', NULL),
  ('00000000-0000-0000-0002-000000000007','Kylie Anderson','kylie.anderson.test@budstest.dev','0412 000 007',
   'cleaning','home','none','4-bed house, deep clean, oven + fridge',240,240,240,'finalized','paid',
   '9 Rochedale Rd, Rochedale South QLD 4123',true, NOW()-INTERVAL '50 days', NOW()-INTERVAL '48 days'),
  ('00000000-0000-0000-0002-000000000008','David Nguyen','david.nguyen.test@budstest.dev','0412 000 008',
   'dump-run','home','none','Small trailer load, old furniture + garden waste',280,280,280,'finalized','not_requested',
   '56 Kingston Rd, Slacks Creek QLD 4127',true, NOW()-INTERVAL '9 days', NOW()-INTERVAL '7 days'),
  ('00000000-0000-0000-0002-000000000009','Melissa Patel','melissa.patel.test@budstest.dev','0412 000 009',
   'cleaning','home','weekly','NDIS domestic assistance, 3 hrs/visit',202,202,NULL,'submitted','not_requested',
   '88 Waterford Rd, Waterford West QLD 4133',true, NOW()-INTERVAL '14 days', NULL),
  ('00000000-0000-0000-0002-00000000000a','Tom Wilson','tom.wilson.test@budstest.dev','0412 000 010',
   'commercial-cleaning','commercial','weekly','Small office, 6 desks, kitchen + 2 bathrooms',350,350,350,'finalized','paid',
   '2 Enterprise Ave, Meadowbrook QLD 4131',true, NOW()-INTERVAL '45 days', NOW()-INTERVAL '43 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (id, quote_id, customer_id, customer_name, customer_email, customer_phone,
  service_type, context, segment, scope, frequency, base_price, final_price,
  scheduled_date, scheduled_time, status, is_test, created_at, completed_at) VALUES
  ('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0002-000000000001','00000000-0000-0000-0001-000000000001',
   'Sarah Thompson','sarah.thompson.test@budstest.dev','0412 000 001',
   'cleaning','home','home','3-bed house, standard clean','fortnightly',220,220,
   (NOW()+INTERVAL '5 days')::date,'9:00 AM','scheduled',true,NOW()-INTERVAL '25 days',NULL),
  ('00000000-0000-0000-0003-000000000002','00000000-0000-0000-0002-000000000002','00000000-0000-0000-0001-000000000002',
   'Michael Davies','michael.davies.test@budstest.dev','0412 000 002',
   'lawn-mowing','home','home','Front and back lawn, 600sqm, edging included','none',120,120,
   (NOW()-INTERVAL '35 days')::date,'8:00 AM','completed',true,NOW()-INTERVAL '38 days',NOW()-INTERVAL '35 days'),
  ('00000000-0000-0000-0003-000000000003','00000000-0000-0000-0002-000000000004','00000000-0000-0000-0001-000000000004',
   'James O''Brien','james.obrien.test@budstest.dev','0412 000 004',
   'end-of-lease','home','home','3-bed 2-bath unit, oven, carpet steam clean','none',420,420,
   (NOW()-INTERVAL '50 days')::date,'7:30 AM','completed',true,NOW()-INTERVAL '55 days',NOW()-INTERVAL '50 days'),
  ('00000000-0000-0000-0003-000000000004','00000000-0000-0000-0002-000000000005','00000000-0000-0000-0001-000000000005',
   'Lisa Chang','lisa.chang.test@budstest.dev','0412 000 005',
   'cleaning','home','home','4-bed house, full clean','fortnightly',185,185,
   NOW()::date,'10:00 AM','in_progress',true,NOW()-INTERVAL '16 days',NULL),
  ('00000000-0000-0000-0003-000000000005','00000000-0000-0000-0002-000000000007','00000000-0000-0000-0001-000000000007',
   'Kylie Anderson','kylie.anderson.test@budstest.dev','0412 000 007',
   'cleaning','home','home','4-bed house, deep clean, oven + fridge','none',240,240,
   (NOW()-INTERVAL '45 days')::date,'9:00 AM','completed',true,NOW()-INTERVAL '48 days',NOW()-INTERVAL '45 days'),
  ('00000000-0000-0000-0003-000000000006','00000000-0000-0000-0002-000000000008','00000000-0000-0000-0001-000000000008',
   'David Nguyen','david.nguyen.test@budstest.dev','0412 000 008',
   'dump-run','home','home','Small trailer load, old furniture + garden waste','none',280,280,
   (NOW()+INTERVAL '2 days')::date,'7:00 AM','pending',true,NOW()-INTERVAL '7 days',NULL),
  ('00000000-0000-0000-0003-000000000007','00000000-0000-0000-0002-00000000000a','00000000-0000-0000-0001-00000000000a',
   'Tom Wilson','tom.wilson.test@budstest.dev','0412 000 010',
   'commercial-cleaning','commercial','commercial','Small office, 6 desks, kitchen + 2 bathrooms','weekly',350,350,
   (NOW()-INTERVAL '43 days')::date,'6:00 AM','completed',true,NOW()-INTERVAL '45 days',NOW()-INTERVAL '43 days')
ON CONFLICT (id) DO NOTHING;

UPDATE quotes SET converted_order_id='00000000-0000-0000-0003-000000000001' WHERE id='00000000-0000-0000-0002-000000000001' AND converted_order_id IS NULL;
UPDATE quotes SET converted_order_id='00000000-0000-0000-0003-000000000002' WHERE id='00000000-0000-0000-0002-000000000002' AND converted_order_id IS NULL;
UPDATE quotes SET converted_order_id='00000000-0000-0000-0003-000000000003' WHERE id='00000000-0000-0000-0002-000000000004' AND converted_order_id IS NULL;
UPDATE quotes SET converted_order_id='00000000-0000-0000-0003-000000000004' WHERE id='00000000-0000-0000-0002-000000000005' AND converted_order_id IS NULL;
UPDATE quotes SET converted_order_id='00000000-0000-0000-0003-000000000005' WHERE id='00000000-0000-0000-0002-000000000007' AND converted_order_id IS NULL;
UPDATE quotes SET converted_order_id='00000000-0000-0000-0003-000000000006' WHERE id='00000000-0000-0000-0002-000000000008' AND converted_order_id IS NULL;
UPDATE quotes SET converted_order_id='00000000-0000-0000-0003-000000000007' WHERE id='00000000-0000-0000-0002-00000000000a' AND converted_order_id IS NULL;

INSERT INTO ratings (id, order_id, customer_id, rating, comment, is_test, created_at) VALUES
  ('00000000-0000-0000-0006-000000000001','00000000-0000-0000-0003-000000000002','00000000-0000-0000-0001-000000000002',
   5,'Brilliant job on the lawns! Crew arrived on time, very efficient and left everything looking great. Will definitely book again.',
   true,NOW()-INTERVAL '34 days'),
  ('00000000-0000-0000-0006-000000000002','00000000-0000-0000-0003-000000000003','00000000-0000-0000-0001-000000000004',
   4,'Really happy with the end of lease clean. Got our bond back without any issues. Would have been 5 stars but they missed behind the fridge.',
   true,NOW()-INTERVAL '49 days'),
  ('00000000-0000-0000-0006-000000000003','00000000-0000-0000-0003-000000000005','00000000-0000-0000-0001-000000000007',
   5,'Absolutely spotless! The team did an incredible job on our deep clean — oven looks brand new. Highly recommend to anyone in Rochedale.',
   true,NOW()-INTERVAL '44 days'),
  ('00000000-0000-0000-0006-000000000004','00000000-0000-0000-0003-000000000007','00000000-0000-0000-0001-00000000000a',
   4,'Professional, reliable and thorough. The office is spotless every week. Good communication when they needed to reschedule.',
   true,NOW()-INTERVAL '42 days')
ON CONFLICT (id) DO NOTHING;

-- temperature must be HOT / WARM / COLD / LOST (uppercase)
-- valid response_status: awaiting_response, in_conversation, quoted, booked, completed, no_response, lost
INSERT INTO leads (id, customer_name, customer_email, customer_phone,
  service_type, suburb, service_address, source, response_status, temperature,
  quote_id, first_response_at, booked_at, completed_at, is_test, created_at, updated_at) VALUES
  ('00000000-0000-0000-0004-000000000001','Sarah Thompson','sarah.thompson.test@budstest.dev','0412 000 001',
   'cleaning','Springwood','14 Hillcrest Ave, Springwood QLD 4127','website','quoted','WARM',
   '00000000-0000-0000-0002-000000000001',NOW()-INTERVAL '27 days',NULL,NULL,true,NOW()-INTERVAL '30 days',NOW()-INTERVAL '27 days'),
  ('00000000-0000-0000-0004-000000000002','Michael Davies','michael.davies.test@budstest.dev','0412 000 002',
   'lawn-mowing','Underwood','7 Warrego Cres, Underwood QLD 4119','website','completed','HOT',
   '00000000-0000-0000-0002-000000000002',NOW()-INTERVAL '43 days',NOW()-INTERVAL '38 days',NOW()-INTERVAL '35 days',
   true,NOW()-INTERVAL '45 days',NOW()-INTERVAL '35 days'),
  ('00000000-0000-0000-0004-000000000003','Emma Wilson','emma.wilson.test@budstest.dev','0412 000 003',
   'windows','Sunnybank Hills','22 Sunbury Rd, Sunnybank Hills QLD 4109','instagram','awaiting_response','WARM',
   '00000000-0000-0000-0002-000000000003',NULL,NULL,NULL,true,NOW()-INTERVAL '7 days',NOW()-INTERVAL '7 days'),
  ('00000000-0000-0000-0004-000000000004','James O''Brien','james.obrien.test@budstest.dev','0412 000 004',
   'end-of-lease','Loganlea','3 Regent St, Loganlea QLD 4131','website','completed','HOT',
   '00000000-0000-0000-0002-000000000004',NOW()-INTERVAL '57 days',NOW()-INTERVAL '55 days',NOW()-INTERVAL '50 days',
   true,NOW()-INTERVAL '60 days',NOW()-INTERVAL '50 days'),
  ('00000000-0000-0000-0004-000000000005','Lisa Chang','lisa.chang.test@budstest.dev','0412 000 005',
   'cleaning','Beenleigh','41 Beenleigh-Redland Bay Rd, Beenleigh QLD 4207','website','booked','HOT',
   '00000000-0000-0000-0002-000000000005',NOW()-INTERVAL '17 days',NOW()-INTERVAL '16 days',NULL,
   true,NOW()-INTERVAL '20 days',NOW()-INTERVAL '16 days'),
  ('00000000-0000-0000-0004-000000000006','Robert Martinez','robert.martinez.test@budstest.dev','0412 000 006',
   'car-detailing','Eight Mile Plains','18 Corporate Dr, Eight Mile Plains QLD 4113','messenger','awaiting_response','COLD',
   '00000000-0000-0000-0002-000000000006',NULL,NULL,NULL,true,NOW()-INTERVAL '5 days',NOW()-INTERVAL '5 days'),
  ('00000000-0000-0000-0004-000000000007','Kylie Anderson','kylie.anderson.test@budstest.dev','0412 000 007',
   'cleaning','Rochedale South','9 Rochedale Rd, Rochedale South QLD 4123','website','completed','HOT',
   '00000000-0000-0000-0002-000000000007',NOW()-INTERVAL '53 days',NOW()-INTERVAL '48 days',NOW()-INTERVAL '45 days',
   true,NOW()-INTERVAL '55 days',NOW()-INTERVAL '45 days'),
  ('00000000-0000-0000-0004-000000000008','David Nguyen','david.nguyen.test@budstest.dev','0412 000 008',
   'dump-run','Slacks Creek','56 Kingston Rd, Slacks Creek QLD 4127','website','in_conversation','WARM',
   '00000000-0000-0000-0002-000000000008',NOW()-INTERVAL '8 days',NULL,NULL,
   true,NOW()-INTERVAL '10 days',NOW()-INTERVAL '8 days'),
  ('00000000-0000-0000-0004-000000000009','Melissa Patel','melissa.patel.test@budstest.dev','0412 000 009',
   'cleaning','Waterford West','88 Waterford Rd, Waterford West QLD 4133','website','in_conversation','HOT',
   '00000000-0000-0000-0002-000000000009',NOW()-INTERVAL '13 days',NULL,NULL,
   true,NOW()-INTERVAL '15 days',NOW()-INTERVAL '13 days'),
  ('00000000-0000-0000-0004-00000000000a','Tom Wilson','tom.wilson.test@budstest.dev','0412 000 010',
   'commercial-cleaning','Meadowbrook','2 Enterprise Ave, Meadowbrook QLD 4131','website','completed','HOT',
   '00000000-0000-0000-0002-00000000000a',NOW()-INTERVAL '48 days',NOW()-INTERVAL '43 days',NOW()-INTERVAL '43 days',
   true,NOW()-INTERVAL '50 days',NOW()-INTERVAL '43 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO lead_conversations (id, lead_id, direction, channel, body, author_label, is_test, created_at) VALUES
  ('00000000-0000-0000-0005-000000000001','00000000-0000-0000-0004-000000000001','inbound','website',
   'Hi, I''m interested in a fortnightly clean for my 3-bedroom home in Springwood. Can you give me a quote?','Sarah Thompson',true,NOW()-INTERVAL '30 days'),
  ('00000000-0000-0000-0005-000000000002','00000000-0000-0000-0004-000000000001','outbound','email',
   'Hi Sarah, thanks for reaching out! Quote sent for a fortnightly standard clean at $220/visit.','Buds Team',true,NOW()-INTERVAL '27 days'),
  ('00000000-0000-0000-0005-000000000003','00000000-0000-0000-0004-000000000002','inbound','website',
   'Hi, need my front and back lawns mowed. About 600sqm total. Also want edging done. Located in Underwood.','Michael Davies',true,NOW()-INTERVAL '45 days'),
  ('00000000-0000-0000-0005-000000000004','00000000-0000-0000-0004-000000000002','outbound','email',
   'G''day Michael! Perfect for our lawn team. Quote attached for $120 including edging. We can be there within the week.','Buds Team',true,NOW()-INTERVAL '43 days'),
  ('00000000-0000-0000-0005-000000000005','00000000-0000-0000-0004-000000000002','inbound','email',
   'Sounds great, I''ve accepted the quote. Looking forward to it!','Michael Davies',true,NOW()-INTERVAL '41 days'),
  ('00000000-0000-0000-0005-000000000006','00000000-0000-0000-0004-000000000003','inbound','instagram',
   'Hey! Saw your post on Instagram. Do you do window cleaning in Sunnybank Hills? I have a 2-storey with about 14 windows.','Emma Wilson',true,NOW()-INTERVAL '7 days'),
  ('00000000-0000-0000-0005-000000000007','00000000-0000-0000-0004-000000000004','inbound','website',
   'Moving out of my rental in Loganlea — need a full end of lease clean. 3 bed, 2 bath. Also need oven clean and carpet steam.','James O''Brien',true,NOW()-INTERVAL '60 days'),
  ('00000000-0000-0000-0005-000000000008','00000000-0000-0000-0004-000000000004','outbound','email',
   'Hi James! End of lease is our speciality. Quote is $420 all-in — full clean, oven, carpet steam. Bond-back guarantee.','Buds Team',true,NOW()-INTERVAL '57 days'),
  ('00000000-0000-0000-0005-000000000009','00000000-0000-0000-0004-000000000004','inbound','email',
   'Perfect, just paid. Can you do next Monday morning, 7:30am?','James O''Brien',true,NOW()-INTERVAL '56 days'),
  ('00000000-0000-0000-0005-00000000000a','00000000-0000-0000-0004-000000000004','outbound','email',
   'Locked in! Monday 7:30am confirmed. Confirmation email on its way.','Buds Team',true,NOW()-INTERVAL '55 days'),
  ('00000000-0000-0000-0005-00000000000b','00000000-0000-0000-0004-000000000005','inbound','website',
   'Looking for fortnightly cleaning for my 4-bedroom home in Beenleigh. Full clean each visit. Have 2 dogs — extra vacuuming needed.','Lisa Chang',true,NOW()-INTERVAL '20 days'),
  ('00000000-0000-0000-0005-00000000000c','00000000-0000-0000-0004-000000000005','outbound','email',
   'Hi Lisa! No worries about the dogs — our team loves animals :) Quote is $185 per fortnightly visit. Ready to start ASAP.','Buds Team',true,NOW()-INTERVAL '17 days'),
  ('00000000-0000-0000-0005-00000000000d','00000000-0000-0000-0004-000000000006','inbound','messenger',
   'Hey how much for a full detail on a Landcruiser? Interior and exterior.','Robert Martinez',true,NOW()-INTERVAL '5 days'),
  ('00000000-0000-0000-0005-00000000000e','00000000-0000-0000-0004-000000000007','inbound','website',
   'Want a deep clean on my home in Rochedale South. 4 bedrooms. Need the oven and fridge cleaned properly — they''re pretty bad!','Kylie Anderson',true,NOW()-INTERVAL '55 days'),
  ('00000000-0000-0000-0005-00000000000f','00000000-0000-0000-0004-000000000007','outbound','email',
   'Hi Kylie! We love a challenge. Deep clean + oven + fridge all in for $240. Team will have it sparkling. What dates work for you?','Buds Team',true,NOW()-INTERVAL '53 days'),
  ('00000000-0000-0000-0005-000000000010','00000000-0000-0000-0004-000000000007','inbound','email',
   'Paid! Any Saturday morning works. Can you do this weekend?','Kylie Anderson',true,NOW()-INTERVAL '51 days'),
  ('00000000-0000-0000-0005-000000000011','00000000-0000-0000-0004-000000000008','inbound','website',
   'Need a dump run. Got an old couch, broken bed frame, and some garden waste. Roughly a small trailer load from Slacks Creek.','David Nguyen',true,NOW()-INTERVAL '10 days'),
  ('00000000-0000-0000-0005-000000000012','00000000-0000-0000-0004-000000000008','outbound','email',
   'Hi David! Straightforward job for us. $280 covers collection and disposal. Can do day after tomorrow — does that work?','Buds Team',true,NOW()-INTERVAL '8 days'),
  ('00000000-0000-0000-0005-000000000013','00000000-0000-0000-0004-000000000009','inbound','website',
   'I''m an NDIS participant and need domestic assistance each week. About 3 hours per visit for cleaning and laundry support.','Melissa Patel',true,NOW()-INTERVAL '15 days'),
  ('00000000-0000-0000-0005-000000000014','00000000-0000-0000-0004-000000000009','outbound','email',
   'Hi Melissa! We''re registered to work with NDIS participants. Our support worker rate is $67.56/hr. 3 hrs weekly = approx $202/visit.','Buds Team',true,NOW()-INTERVAL '13 days'),
  ('00000000-0000-0000-0005-000000000015','00000000-0000-0000-0004-000000000009','inbound','email',
   'Great, thank you. My plan is agency-managed. I''ll have my support coordinator contact you to arrange the service agreement.','Melissa Patel',true,NOW()-INTERVAL '12 days'),
  ('00000000-0000-0000-0005-000000000016','00000000-0000-0000-0004-00000000000a','inbound','website',
   'We need weekly cleaning for our small office in Meadowbrook. 6 workstations, kitchen, 2 bathrooms. After hours preferred.','Tom Wilson',true,NOW()-INTERVAL '50 days'),
  ('00000000-0000-0000-0005-000000000017','00000000-0000-0000-0004-00000000000a','outbound','email',
   'Hi Tom! We handle plenty of commercial clients in that area. After-hours $350/week — full office, kitchen, and both bathrooms. Can start this week.','Buds Team',true,NOW()-INTERVAL '48 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO conversations (id, entity_type, entity_id, subject, status, is_test, created_at) VALUES
  ('00000000-0000-0000-0007-000000000001','customer','00000000-0000-0000-0001-000000000002',
   'Post-job follow up — lawn mowing','closed',true,NOW()-INTERVAL '34 days'),
  ('00000000-0000-0000-0007-000000000002','customer','00000000-0000-0000-0001-000000000007',
   'Deep clean booking confirmation','closed',true,NOW()-INTERVAL '48 days'),
  ('00000000-0000-0000-0007-000000000003','customer','00000000-0000-0000-0001-000000000009',
   'NDIS service agreement — Melissa Patel','open',true,NOW()-INTERVAL '12 days')
ON CONFLICT (id) DO NOTHING;

-- sender_type: 'admin' or 'entity' (entity = the customer/crew member)
INSERT INTO messages (id, conversation_id, sender_type, body, channel, delivery_status, is_test, created_at) VALUES
  ('00000000-0000-0000-0008-000000000001','00000000-0000-0000-0007-000000000001',
   'admin','Hi Michael, just checking in — happy with the lawn work from our team last week?','email','sent',true,NOW()-INTERVAL '34 days'),
  ('00000000-0000-0000-0008-000000000002','00000000-0000-0000-0007-000000000001',
   'entity','Yes, really happy! Looks great. Left a 5-star review for you.','email','sent',true,NOW()-INTERVAL '33 days'),
  ('00000000-0000-0000-0008-000000000003','00000000-0000-0000-0007-000000000002',
   'admin','Hi Kylie, confirming the deep clean this Saturday at 9am. The team will bring all supplies.','email','sent',true,NOW()-INTERVAL '48 days'),
  ('00000000-0000-0000-0008-000000000004','00000000-0000-0000-0007-000000000002',
   'entity','Perfect, thank you! See you Saturday.','email','sent',true,NOW()-INTERVAL '47 days'),
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0007-000000000003',
   'admin','Hi Melissa, I''ve prepared the NDIS service agreement. Sending it to your support coordinator today.','email','sent',true,NOW()-INTERVAL '12 days'),
  ('00000000-0000-0000-0008-000000000006','00000000-0000-0000-0007-000000000003',
   'entity','Thank you, her name is Sandra Briggs at Support First.','email','sent',true,NOW()-INTERVAL '11 days'),
  ('00000000-0000-0000-0008-000000000007','00000000-0000-0000-0007-000000000003',
   'admin','Great, I''ve reached out to Sandra. Agreement should be signed within a day or two.','email','draft',true,NOW()-INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;
