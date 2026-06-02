'use client';

import { useState } from 'react';
import { crewTheme } from '@/lib/design-system/themes';

type Context = 'home' | 'commercial' | 'ndis';
type Service = 'cleaning' | 'windows' | 'yard' | 'dump' | 'detailing' | 'laundry';

const CONTEXTS: { id: Context; label: string; icon: string }[] = [
  { id: 'home', label: 'Home / Residential', icon: '🏠' },
  { id: 'commercial', label: 'Commercial', icon: '🏢' },
  { id: 'ndis', label: 'NDIS / Support', icon: '💜' },
];

const SERVICES: { id: Service; label: string; icon: string }[] = [
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'windows', label: 'Window Cleaning', icon: '🪟' },
  { id: 'yard', label: 'Yard Care', icon: '🌿' },
  { id: 'dump', label: 'Dump Runs', icon: '🚛' },
  { id: 'detailing', label: 'Car Detailing', icon: '🚗' },
  { id: 'laundry', label: 'Laundry', icon: '👕' },
];

type SopEntry = {
  title: string;
  steps: string[];
  standards: string[];
  safety: string[];
  contextNotes: string;
};

const SOP: Record<Service, Record<Context, SopEntry>> = {
  cleaning: {
    home: {
      title: 'Residential Cleaning',
      steps: [
        'Arrive on time. Greet the client, confirm the scope, and do a walk-through together before starting.',
        'Collect your supplies from the van — never use the client\'s products without explicit permission.',
        'Work top-to-bottom, back-to-front: start with high surfaces (ceiling fans, shelves) before floors.',
        'Kitchen: degrease stovetop, wipe benches, clean sink and fixtures, wipe exterior of appliances, mop.',
        'Bathrooms: scrub toilet bowl and seat, clean basin and shower/bath, wipe mirrors, mop floor.',
        'Bedrooms/living: dust furniture, vacuum soft surfaces, wipe skirting boards, vacuum or mop floors.',
        'Empty bins into a single bag, tie and place at the front door for client to dispose.',
        'Do a final walk-through — photograph completed areas if anything was pre-existing or unusual.',
        'Lock up as agreed, leave a completion card or send a done notification via the app.',
      ],
      standards: [
        'Microfibre cloths only — colour-coded: blue for general surfaces, red for bathrooms.',
        'Never mix cleaning chemicals. Never use bleach near coloured grout or fabrics without warning.',
        'Leave a room smelling neutral, not heavily fragranced.',
        'Replace items exactly where you found them.',
        'If something breaks or spills, tell the client immediately — don\'t hide it.',
      ],
      safety: [
        'Wet floor signs whenever mopping in shared spaces.',
        'Gloves on for all chemical contact.',
        'No climbing furniture — use the provided step stool only.',
        'Report any unsafe electrical fittings, animal hazards, or suspected mould to the office.',
      ],
      contextNotes: 'The client is in their private home. Be respectful, quiet, and unobtrusive. Knock before entering any room.',
    },
    commercial: {
      title: 'Commercial Cleaning',
      steps: [
        'Check the job sheet for access codes, keyholder contacts, and any restricted zones.',
        'Sign into the site register if one exists.',
        'Work to the scope listed on the job — do not clean areas outside scope without authorisation.',
        'Offices: empty bins, wipe desks (around items, not moving), vacuum, mop hard floors.',
        'Bathrooms: full sanitise of all fixtures, restock paper products if included in scope.',
        'Kitchen/breakroom: wipe benches and appliances, clean sink, mop.',
        'Glass and entry areas: streak-free glass, mop entrance mats.',
        'Log your completion time and any issues in the job notes.',
      ],
      standards: [
        'Commercial-grade disinfectant for bathrooms and kitchens.',
        'Follow the site\'s waste stream rules — general, recycling, confidential shredding.',
        'Do not touch or move client documents, computers, or equipment on desks.',
        'Wear the Buds At Work uniform or hi-vis if required by the site.',
      ],
      safety: [
        'Lock external doors behind you when entering after hours.',
        'If an alarm triggers, follow the client\'s emergency contact instructions on the job sheet.',
        'No headphones — you need to be alert in an after-hours commercial setting.',
        'Report any maintenance issues (lights out, water leaks, broken locks) to the site contact.',
      ],
      contextNotes: 'Commercial clients judge quality by consistency. The same standard every visit, every time.',
    },
    ndis: {
      title: 'NDIS Cleaning (Household Tasks)',
      steps: [
        'Read the participant\'s support plan notes before every visit — needs can change.',
        'Introduce yourself clearly and confirm you are from Buds At Work before entering.',
        'Ask the participant or their nominee what they want prioritised today.',
        'Perform cleaning tasks as per scope — kitchen, bathrooms, vacuuming, mopping, laundry as applicable.',
        'Involve the participant where they wish and where it is safe and appropriate for their goals.',
        'Never rush or pressure a participant. Work at their pace.',
        'Complete a service note in the app immediately after the visit — include what was done, any concerns.',
        'Report any changes in the participant\'s welfare, environment hazards, or carer concerns to the NDIS coordinator.',
      ],
      standards: [
        'Use unscented or hypo-allergenic products if a participant has sensitivities — check notes.',
        'Store all chemicals out of reach if the participant has young children or cognitive needs.',
        'Dignity and respect in all interactions — no assumptions about capability.',
        'Participant information is confidential. Do not discuss their situation outside of work.',
      ],
      safety: [
        'Never lift or physically assist a participant unless you hold a current manual handling certificate.',
        'If you observe signs of abuse, neglect, or a reportable incident, contact the office immediately.',
        'You are a mandatory reporter under NDIS quality and safeguarding rules.',
        'Do not accept gifts, money, or favours from participants.',
      ],
      contextNotes: 'This is a funded support service. The participant\'s dignity, choice, and control are central to every interaction. Your notes directly affect their NDIS review.',
    },
  },

  windows: {
    home: {
      title: 'Residential Window Cleaning',
      steps: [
        'Survey the property on arrival — identify all windows, accessibility, screen types, and condition.',
        'Remove fly screens carefully, label or stack them in sequence so replacement is easy.',
        'Mix solution: a few drops of dish soap per bucket of warm water.',
        'Wet the glass with the applicator, scrub stubborn spots, then squeegee top-to-bottom in overlapping strokes.',
        'Detail the edges with a damp cloth, wipe the sill.',
        'Refit screens — check each one seats correctly before moving on.',
        'Do a final check from outside: no streaks, no water on the frame.',
      ],
      standards: [
        'Zero streaks — check your squeegee rubber before every job, replace if nicked.',
        'Never use razor blades on tinted or double-glazed windows without client consent.',
        'Leave sills dry and free of solution drips.',
        'Internal windows: lay a towel on the sill to protect furnishings.',
      ],
      safety: [
        'No working above 2 m without a Buds At Work–approved ladder or pole system.',
        'Stable footing only — never lean a ladder on a window frame.',
        'Wet ground near windows — use rubber-soled shoes.',
        'High-rise or roof-access windows are out of scope unless specifically cleared by management.',
      ],
      contextNotes: 'Residential clients often schedule window cleans seasonally. Before/after photos help retain repeat business.',
    },
    commercial: {
      title: 'Commercial Window Cleaning',
      steps: [
        'Review site access plan — identify water points, drainage, and any fragile signage or tinting.',
        'For large glass frontages, use the water-fed pole system (purified water, no soap).',
        'Work systematically across all glass panels — mark your position so panels are not missed.',
        'Clean frames, transoms, and mullions with a damp cloth — remove cobwebs from corners.',
        'For internal glass/partitions: streak-free with a microfibre and glass cleaner spray.',
        'Log completion and any glass damage found before your visit.',
      ],
      standards: [
        'High-visibility frontage glass must be streak-free — this reflects on the client\'s business.',
        'Do not block building entrances during peak business hours.',
        'All cleaning water must be directed to drains, not footpaths.',
      ],
      safety: [
        'WH&S SWMS required for any work above 2 m — check your job sheet.',
        'Wet footpath: place hazard cones and signage toward the street.',
        'Avoid cleaning in direct sun on hot days — solution dries too fast and streaks.',
      ],
      contextNotes: 'Commercial clients often need work completed outside business hours. Confirm access and timing in advance.',
    },
    ndis: {
      title: 'NDIS Window Cleaning (Household)',
      steps: [
        'Confirm the scope with the participant or their support coordinator before starting.',
        'Internal windows only unless external access is safe and within scope.',
        'Explain what you are doing before moving furniture or opening windows.',
        'Use unscented solution if the participant has respiratory sensitivities.',
        'Ensure all windows are fully closed and latched when done if the participant cannot manage this.',
      ],
      standards: [
        'Leave the environment exactly as found — no furniture moved without permission.',
        'Noise-sensitive participants: no splashing or loud squeegee noise on hard frames.',
      ],
      safety: [
        'Never climb furniture — bring your own step stool.',
        'Check windows for safety latches/child locks and refit them after cleaning.',
      ],
      contextNotes: 'For participants with respiratory conditions, ensure the space is well-ventilated after cleaning. Document any window maintenance concerns (broken latches, condensation issues) in service notes.',
    },
  },

  yard: {
    home: {
      title: 'Residential Yard Care',
      steps: [
        'Walk the yard with the client (or review job notes if unattended) before starting.',
        'Check for hazards: irrigation lines, tree stumps, pet waste, or unfamiliar plants.',
        'Mow using the correct height setting for the season — standard is mid-height in summer, slightly higher in winter.',
        'Edge along paths, driveways, and garden beds with the line trimmer.',
        'Blow clippings off hard surfaces onto lawn or garden beds, then rake or blow into piles.',
        'Remove all clippings and green waste as per scope — bag or pile for client disposal unless green bin collection is included.',
        'Prune overgrown shrubs to the agreed height, not beyond.',
        'Weed visible garden beds if in scope — pull roots, don\'t just cut.',
        'Leave gates as you found them — latched if they were latched.',
      ],
      standards: [
        'Even mow height — no scalping on bumps, no missed strips.',
        'No damage to garden beds, irrigation heads, or edging.',
        'Never trim more than one-third of a plant\'s height in a single visit.',
        'All equipment clean and refuelled before next job.',
      ],
      safety: [
        'Safety glasses and ear protection when operating mowers and trimmers.',
        'Check for children and pets before starting any powered equipment.',
        'No mowing on wet slopes — reschedule if unsafe.',
        'Secure all equipment on the van before driving between sites.',
      ],
      contextNotes: 'Residential yard care is a recurring service — consistency builds loyalty. Note anything unusual (dying turf patches, irrigation leaks) in the job record.',
    },
    commercial: {
      title: 'Commercial Grounds Maintenance',
      steps: [
        'Check the site grounds plan for any restricted or high-traffic areas.',
        'Coordinate with site management if mowing near car parks or public areas.',
        'Mow and edge all designated turf areas, including nature strips if in scope.',
        'Blow all hard surfaces clear of clippings and debris.',
        'Remove all waste — commercial sites do not accept clipping piles left on site.',
        'Log completion time and any damage or irrigation faults observed.',
      ],
      standards: [
        'Presentable frontage is non-negotiable for commercial clients.',
        'Uniform mow height across the entire site — use a ride-on if available and licensed.',
        'Strimmer work around bollards, signage, and drainage grates.',
      ],
      safety: [
        'Hi-vis vest required when working near car parks or pedestrian paths.',
        'Traffic management plan if working adjacent to roads — check job sheet.',
        'Report any irrigation leaks, structural damage to paving, or pest activity.',
      ],
      contextNotes: 'Commercial grounds work is often time-sensitive (site opens at X). Plan arrival and completion to meet the window.',
    },
    ndis: {
      title: 'NDIS Yard Care (Home Maintenance)',
      steps: [
        'Confirm scope with the participant — some participants will want to be involved in decisions about their garden.',
        'Work at a pace that is not distressing — avoid loud power equipment near participants who are noise-sensitive.',
        'Explain what you are about to do before starting each task.',
        'Prioritise safety: clear pathways, remove trip hazards, and ensure access to the home is maintained throughout.',
        'Ask before removing or pruning any plants — they may hold personal significance.',
      ],
      standards: [
        'Leave the yard safe and accessible — no clippings on paths, gates latched.',
        'Dispose of green waste as agreed — many participants cannot manage bins independently.',
      ],
      safety: [
        'No power equipment use if the participant or others with support needs are immediately nearby.',
        'Check for mobility aid pathways — keep them clear and obstacle-free at all times.',
      ],
      contextNotes: 'For many NDIS participants, a maintained yard supports their independence and safety at home. Your work directly contributes to their quality of life.',
    },
  },

  dump: {
    home: {
      title: 'Residential Dump Runs',
      steps: [
        'Confirm what is being removed before loading — photograph the items and obtain verbal or written approval.',
        'Sort items on site where possible: general waste, recycling, metals (council may take separately).',
        'Load the van safely — heavier items on the floor, nothing overloaded above the roofline.',
        'Secure all items with tie-down straps before driving.',
        'Drive to the approved transfer station (see job notes for location).',
        'Unload at the correct waste stream bays — never put recyclables in general waste.',
        'Obtain and photograph the weighbridge receipt and upload to the job in the app.',
        'Return to the client to confirm completion if they are home.',
      ],
      standards: [
        'Never dump illegally — not on roadsides, bushland, or unregistered sites.',
        'Maximum load as per van capacity — do not overload.',
        'Bulky or hazardous items (paint, asbestos, chemicals) require pre-authorisation — do not handle without written approval.',
      ],
      safety: [
        'Gloves and steel-cap boots when loading sharp or heavy items.',
        'Two-person lift for anything over 25 kg.',
        'No broken glass loaded loose — wrap before loading.',
        'Secure the van load before every drive, including short distances.',
      ],
      contextNotes: 'Council tip fees vary — confirm the fee estimate with the client in advance and collect payment or process through the app before proceeding.',
    },
    commercial: {
      title: 'Commercial Waste Removal',
      steps: [
        'Confirm with the site manager what is approved for removal and which waste streams apply.',
        'Identify and separate: general, recycling, e-waste, confidential, and any regulated waste.',
        'Photograph the removal area before and after.',
        'Load and secure to transport standards.',
        'Deliver to the appropriate licensed waste facility.',
        'Collect receipts and upload to the job.',
      ],
      standards: [
        'Regulated or hazardous commercial waste requires a licensed carrier — do not transport without approval.',
        'Confidential materials must go to a secure shredding service, not general waste.',
        'Receipts and waste tracking documentation must be provided to the client.',
      ],
      safety: [
        'Chemical and biological hazard identification — if unsure, stop and contact the office.',
        'Use trolleys for heavy equipment — no manual lifts over 25 kg solo.',
        'Site-specific PPE requirements apply — check the job sheet.',
      ],
      contextNotes: 'Commercial dump runs often involve business-critical waste streams. Compliance documentation matters — keep all receipts.',
    },
    ndis: {
      title: 'NDIS Rubbish Removal (Home)',
      steps: [
        'Walk through the space with the participant or their support person before removing anything.',
        'Never discard items without the participant\'s explicit confirmation — items that look like rubbish may have significance.',
        'Work slowly and respectfully — hoarding and clutter can be connected to trauma or complex needs.',
        'Clear one area at a time, returning for the participant\'s approval at each stage.',
        'Dispose of waste at approved facilities, within the agreed scope and NDIS budget.',
      ],
      standards: [
        'Participant choice and control guides every decision about what to remove.',
        'Do not photograph the participant\'s property without consent.',
        'Document what was removed in service notes — NDIS audits require this.',
      ],
      safety: [
        'Hidden sharps risk in cluttered environments — never reach into piles without gloves and visual inspection first.',
        'Respiratory risk in dusty or mouldy environments — wear a mask.',
        'If the environment is hazardous (asbestos, rodent activity, raw sewage), stop and contact the office.',
      ],
      contextNotes: 'Rubbish removal in a participant\'s home is a sensitive, personal task. Approach with empathy and without judgement. Your notes will inform future support planning.',
    },
  },

  detailing: {
    home: {
      title: 'Mobile Car Detailing (Residential)',
      steps: [
        'Park safely and position equipment without blocking access for the client or neighbours.',
        'Pre-rinse the vehicle to loosen dirt before applying foam or soap.',
        'Hand wash with a two-bucket method — wash bucket and rinse bucket, grit guards in both.',
        'Clean wheels and wheel arches first (most contaminated), then body panels, then glass.',
        'Dry thoroughly with microfibre drying towels — no air-dry streaking.',
        'Interior (if in scope): vacuum all surfaces including boot, wipe dash and console, clean glass inside, deodorise.',
        'Final inspection: check for missed spots, bird dropping residue, water spots, open boot or fuel cap.',
        'Park the vehicle back in its spot and let the client inspect.',
      ],
      standards: [
        'Two-bucket wash is non-negotiable — cross-contamination scratches paintwork.',
        'pH-neutral shampoo on all painted surfaces.',
        'Clay bar use on contaminated paint only — confirm with client if you recommend it (extra charge).',
        'No water near open windows or sunroofs — close them before starting.',
        'Interior chemicals: no silicone dressing on steering wheels (slip hazard).',
      ],
      safety: [
        'Water near concrete — lay rubber mats to prevent slipping.',
        'Chemical splash: keep eye wash in your kit, wear safety glasses when using degreasers.',
        'Electrical: water-fed equipment must use GFCI-protected power if using the client\'s power point.',
        'Never leave the client\'s vehicle running unattended.',
      ],
      contextNotes: 'Residential detailing clients want results and convenience. Arrive fully equipped — never ask to use their hose without prior arrangement.',
    },
    commercial: {
      title: 'Fleet / Commercial Vehicle Detailing',
      steps: [
        'Obtain the vehicle access list and any fleet-specific requirements from the fleet manager.',
        'Pre-rinse, foam, and wash in a logical bay sequence — move vehicles as directed by the site.',
        'Note any pre-existing damage on each vehicle before starting — photograph and log in the app.',
        'Full exterior wash and dry; interior to the agreed standard (tidy vs. full detail).',
        'Complete a vehicle condition log for each unit when done.',
      ],
      standards: [
        'Consistent standard across all fleet vehicles — no variation.',
        'Fleet logos and vinyl wraps: pH-neutral products only, no pressure on wrap edges.',
        'Do not move vehicles without a valid driver\'s licence and manager authorisation.',
      ],
      safety: [
        'Working in open bays: hi-vis if other vehicles are moving nearby.',
        'Fuel hazard: no cleaning near running engines or refuelling areas.',
        'Comply with the site\'s chemical storage and waste water rules.',
      ],
      contextNotes: 'Commercial fleet clients value speed and consistency. They also need documentation — vehicle condition reports protect both parties.',
    },
    ndis: {
      title: 'NDIS Vehicle Detailing (Transport Support)',
      steps: [
        'Confirm the vehicle\'s owner or nominee and obtain consent before starting.',
        'Adapt the service to accessibility needs — the participant may use the vehicle daily and rely on familiar placement of items.',
        'Clean around mobility aids, adaptive controls, and safety equipment without moving them unless approved.',
        'Use unscented or low-VOC products if the participant has sensitivities.',
        'Return all items to their original position.',
      ],
      standards: [
        'Never remove or reposition wheelchair securement anchors, hand controls, or other adaptive equipment.',
        'Leave the vehicle ready to drive — seats in position, mirrors as found.',
      ],
      safety: [
        'Adaptive vehicle interiors may have specialised electrical systems — no water inside near control panels.',
        'Confirm the vehicle is not needed for an appointment before starting a job that will take time.',
      ],
      contextNotes: 'For many NDIS participants, their vehicle is their independence. A clean, reliable vehicle supports their daily life and dignity.',
    },
  },

  laundry: {
    home: {
      title: 'Residential Laundry Service',
      steps: [
        'Collect laundry in the client\'s provided bags or Buds At Work laundry bags — never loose.',
        'Sort on collection: whites, colours, delicates, and items requiring special care.',
        'Check all pockets before washing.',
        'Photograph any pre-existing stains, tears, or damage before washing.',
        'Wash according to garment care labels — cold for colours and delicates, warm for cottons.',
        'Do not mix unknown items with each other — per-household loads only.',
        'Dry as per client instructions — line dry delicates unless advised otherwise.',
        'Fold neatly or hang garments to minimise creasing.',
        'Return to the client in a clean bag, folded and sorted.',
      ],
      standards: [
        'No mixing of clients\' laundry at any stage.',
        'Unscented or hypo-allergenic detergent available on request — carry both.',
        'Delicates and woollens: cold water, gentle cycle only.',
        'Never put items in the dryer if the label says line-dry.',
        'Anything stained and not salvageable: inform the client before returning, do not discard.',
      ],
      safety: [
        'Check all clothing for pins, needles, or sharps before handling — especially for NDIS clients.',
        'Do not wash items that appear to be contaminated with biological fluids — notify the office.',
        'Laundry chemicals: gloves on when handling concentrated detergent or stain remover.',
      ],
      contextNotes: 'Clients trust us with personal items. Accuracy, care, and respect for their belongings is the baseline.',
    },
    commercial: {
      title: 'Commercial Laundry (Linens / Uniforms)',
      steps: [
        'Collect commercial laundry per client\'s collection schedule and bagging system.',
        'Sort by item type and soil level — heavily soiled commercial laundry washes separately.',
        'Use commercial-grade detergent at correct dosage for load size.',
        'Follow the client\'s fold or hang specifications for return.',
        'Return sorted and labelled per client\'s system (room numbers, department, etc.).',
        'Log quantities collected and returned for billing.',
      ],
      standards: [
        'Hygiene standards for commercial linens: hot wash (60°C+) where items permit.',
        'Zero cross-contamination between commercial clients.',
        'Return in a timely manner — commercial clients have operational turnaround needs.',
      ],
      safety: [
        'Soiled commercial laundry (hospitality, aged care): PPE including gloves and apron.',
        'Biological hazard items require separate handling protocols — contact the office if unsure.',
      ],
      contextNotes: 'Commercial laundry is operational — any delays affect the client\'s business. Communicate ETA proactively.',
    },
    ndis: {
      title: 'NDIS Laundry (Daily Living Support)',
      steps: [
        'Assist the participant with sorting if they wish to be involved — this supports their independence goals.',
        'Follow the participant\'s preferences for detergent, softener, and drying — these are recorded in their support plan.',
        'Complete the task within the home unless otherwise arranged.',
        'Help fold and put away clothes if that is within scope and the participant\'s goal.',
        'Record what was completed in the service note.',
      ],
      standards: [
        'Use only the participant\'s own products unless they have specifically requested otherwise.',
        'Respect the participant\'s preferences about how their clothing is folded, sorted, and stored.',
        'Do not rush — for many participants this is skill-building, not just task completion.',
      ],
      safety: [
        'Check for hidden sharps in clothing and pockets.',
        'Washing machines and dryers: ensure the participant is not at risk near hot appliances.',
        'Report any appliance faults (leaking machine, broken door seal) in the service note.',
      ],
      contextNotes: 'NDIS laundry support is about independence and dignity. The participant is not just a recipient — involve them in their own home tasks wherever possible.',
    },
  },
};

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border" style={{ borderColor: crewTheme.color.border }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold" style={{ color }}>{title}</span>
        <ChevronDown open={open} />
      </button>
      {open && (
        <ul className="space-y-2 border-t px-4 pb-4 pt-3" style={{ borderColor: crewTheme.color.border }}>
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm" style={{ color: crewTheme.color.text }}>
              <span className="mt-0.5 shrink-0 text-xs font-bold" style={{ color }}>{i + 1}.</span>
              <span className="leading-6">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SafetySection({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border" style={{ borderColor: '#FECACA', background: '#FFF5F5' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Safety & Compliance</span>
        <ChevronDown open={open} />
      </button>
      {open && (
        <ul className="space-y-2 border-t px-4 pb-4 pt-3" style={{ borderColor: '#FECACA' }}>
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm" style={{ color: '#7F1D1D' }}>
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span className="leading-6">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HandbookPage() {
  const [activeContext, setActiveContext] = useState<Context>('home');
  const [activeService, setActiveService] = useState<Service>('cleaning');

  const entry = SOP[activeService][activeContext];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: crewTheme.color.text }}>Service Handbook</h1>
        <p className="mt-1 text-sm" style={{ color: crewTheme.color.muted }}>
          Standard operating procedures for all Buds At Work services. Read the relevant section before each job.
        </p>
      </div>

      {/* Context selector */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: crewTheme.color.muted }}>Service context</p>
        <div className="flex gap-2 flex-wrap">
          {CONTEXTS.map((ctx) => (
            <button
              key={ctx.id}
              onClick={() => setActiveContext(ctx.id)}
              className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
              style={
                activeContext === ctx.id
                  ? { background: crewTheme.color.primary, borderColor: crewTheme.color.primary, color: 'white' }
                  : { background: 'white', borderColor: crewTheme.color.border, color: crewTheme.color.muted }
              }
            >
              <span>{ctx.icon}</span>
              <span>{ctx.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Service selector */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: crewTheme.color.muted }}>Service type</p>
        <div className="flex gap-2 flex-wrap">
          {SERVICES.map((svc) => (
            <button
              key={svc.id}
              onClick={() => setActiveService(svc.id)}
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
              style={
                activeService === svc.id
                  ? { background: '#EFF6FF', borderColor: '#93C5FD', color: '#1D4ED8' }
                  : { background: 'white', borderColor: crewTheme.color.border, color: crewTheme.color.muted }
              }
            >
              <span>{svc.icon}</span>
              <span>{svc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SOP content */}
      <div className={`${crewTheme.glass} rounded-3xl p-1`}>
        <div className="rounded-2xl px-5 py-4" style={{ background: '#F8FBF9' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{SERVICES.find((s) => s.id === activeService)?.icon}</span>
            <div>
              <h2 className="text-base font-bold" style={{ color: crewTheme.color.text }}>{entry.title}</h2>
              <p className="text-xs mt-0.5" style={{ color: crewTheme.color.muted }}>
                {CONTEXTS.find((c) => c.id === activeContext)?.label} context
              </p>
            </div>
          </div>
          {entry.contextNotes && (
            <div className="mt-3 rounded-xl border-l-4 pl-3 py-1" style={{ borderColor: crewTheme.color.primary }}>
              <p className="text-xs leading-5" style={{ color: crewTheme.color.muted }}>{entry.contextNotes}</p>
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <Section title="Step-by-step procedure" items={entry.steps} color={crewTheme.color.primary} />
          <Section title="Quality standards" items={entry.standards} color="#0F766E" />
          <SafetySection items={entry.safety} />
        </div>
      </div>

      <div className="rounded-2xl border px-5 py-4 text-sm" style={{ borderColor: crewTheme.color.border, color: crewTheme.color.muted }}>
        Questions about a job? Contact Jackson at <a href="mailto:admin@budsatwork.com" className="font-medium underline" style={{ color: crewTheme.color.primary }}>admin@budsatwork.com</a> before starting work, not after.
      </div>
    </div>
  );
}
