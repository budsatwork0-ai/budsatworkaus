'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { brand, ui, cx, glass, glassSoft } from '../../ui/theme';
import QualityPartnerForm from './QualityPartnerForm';
import InnovationPartnerForm from './InnovationPartnerForm';

const ROLE_OPTS = ['Casual crew', 'Support worker', 'Quality partner', 'Innovation partner'] as const;
type Role = (typeof ROLE_OPTS)[number];

const FUNDING_CHOICES = [
  { value: 'NDIS-managed', label: 'My plan is managed by the NDIS' },
  { value: 'Plan-managed', label: 'My plan is managed by a plan manager' },
  { value: 'Self-managed', label: 'I manage my own plan' },
  { value: 'Not sure', label: "I'm not sure" },
] as const;
type FundingType = (typeof FUNDING_CHOICES)[number]['value'];
const FUNDING_VALUES: FundingType[] = FUNDING_CHOICES.map((opt) => opt.value);
type MobilityAid = 'None' | 'Folding chair' | 'Walker' | 'Other';
type BootSpace = 'Small' | 'Medium' | 'Large';

const AVAIL_OPTS = ['Weekdays', 'Evenings', 'Weekends'] as const;
const SERVICE_OPTS = [
  'Home cleaning',
  'Window cleaning',
  'Yard & garden',
  'Dump runs',
  'Car washing & detailing',
  'Handyman / maintenance',
] as const;

const STORAGE_KEY = 'getInvolvedForm.simplified.final2';

/* helpers */
const enc = (s: string) => encodeURIComponent(s);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isPhoneish = (v: string) => v.trim() === '' || /^[\d\s()+-]{8,}$/.test(v.trim());
const isABNish = (v: string) => v.trim() === '' || v.replace(/\s+/g, '').length === 11;

function toggleLimited(arr: string[], val: string, setArr: (s: string[]) => void, cap = 2) {
  if (arr.includes(val)) setArr(arr.filter((x) => x !== val));
  else if (arr.length < cap) setArr([...arr, val]);
}

/* Icons */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function BriefcaseIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <path d="M12 12v.01" />
    </svg>
  );
}

function HeartHandIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3.332.892-4.5 2.273A5.824 5.824 0 007.5 3 5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z" />
      <path d="M12 5L9.04 7.96a2.5 2.5 0 000 3.54L12 14.5l2.96-2.96a2.5 2.5 0 000-3.54L12 5z" />
    </svg>
  );
}

function BadgeCheckIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M12 2l2.4 2.4h3.4v3.4L20 10l-2.2 2.2v3.4h-3.4L12 18l-2.4-2.4H6.2v-3.4L4 10l2.2-2.2V4.4h3.4L12 2z" />
      <path d="M9 10l2 2 4-4" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 10-16 0" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M3 13l2-5a3 3 0 012.8-2h8.4A3 3 0 0119 8l2 5" />
      <path d="M5 13h14" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M3 13v4M21 13v4" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 5L2 7" />
    </svg>
  );
}

function IconWrap({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };
  return (
    <div
      className={cx(
        'grid place-items-center rounded-2xl border border-black/10 bg-white/70 backdrop-blur shadow-[0_10px_26px_rgba(2,6,23,0.06)]',
        sizeClasses[size]
      )}
      style={{ color: brand.primary }}
    >
      {children}
    </div>
  );
}

const ROLE_META: Record<Role, { icon: React.ReactNode; title: string; tagline: string; description: string; bullets: string[] }> = {
  'Casual crew': {
    icon: <BriefcaseIcon />,
    title: 'Join the crew',
    tagline: 'Paid work on your terms',
    description: "Pick the work you like and when you're free. If you need transport or support, we'll help you step by step.",
    bullets: ['Choose work that suits you', 'Set your own availability', 'Transport support available'],
  },
  'Support worker': {
    icon: <HeartHandIcon />,
    title: 'Support others',
    tagline: 'Help crew members thrive',
    description: 'Use your car, skills, and care to help others get to jobs and succeed. We ask a few safety checks first.',
    bullets: ['Drive and support crew members', 'Flexible scheduling', 'Make a real difference'],
  },
  'Quality partner': {
    icon: <BadgeCheckIcon />,
    title: 'Improve our work',
    tagline: 'Share your expertise',
    description: 'Share advice, tips, or honest feedback. Help us do better cleaning, yard care, or detailing work.',
    bullets: ['Share industry knowledge', 'Mentor our team', 'No obligation involved'],
  },
  'Innovation partner': {
    icon: <LightbulbIcon />,
    title: 'Test new ideas',
    tagline: 'Shape the future with us',
    description: "Try new tools, give feedback, explore accessibility improvements. We'll guide you along the way.",
    bullets: ['Early access to new features', 'Shape training methods', 'Flexible involvement'],
  },
};

export default function GetInvolvedPage() {
  const [role, setRole] = useState<Role>('Casual crew');
  const isCrew = role === 'Casual crew';
  const isWorker = role === 'Support worker';
  const isQualityPartner = role === 'Quality partner';
  const isInnovationPartner = role === 'Innovation partner';
  const isPartner = isQualityPartner || isInnovationPartner;

  // Basics
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Partners
  const [qualityBusinessName, setQualityBusinessName] = useState('');
  const [qualityContributionTypes, setQualityContributionTypes] = useState<string[]>([]);
  const [qualityMessage, setQualityMessage] = useState('');

  const [innovationOrganisation, setInnovationOrganisation] = useState('');
  const [innovationInterestAreas, setInnovationInterestAreas] = useState<string[]>([]);
  const [innovationNotes, setInnovationNotes] = useState('');

  // Preferences
  const [availability, setAvailability] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);

  // Crew transport
  const [needsTransport, setNeedsTransport] = useState(false);
  const [pickupSuburb, setPickupSuburb] = useState('');
  const [rideOptionsOpen, setRideOptionsOpen] = useState(false);
  const [maxRideMins, setMaxRideMins] = useState<15 | 30 | 45 | 60>(30);
  const [mobilityAidCrew, setMobilityAidCrew] = useState<MobilityAid>('None');
  const [ridePrefs, setRidePrefs] = useState<string[]>([]);

  // NDIS participant (crew)
  const [isNDIS, setIsNDIS] = useState(false);
  const [fundingType, setFundingType] = useState<FundingType>('NDIS-managed');
  const [ndisNumber, setNdisNumber] = useState('');
  const [scContact, setScContact] = useState('');

  // Support worker confirmations + quick vehicle details
  const [carCompliant, setCarCompliant] = useState(false);
  const [allClearances, setAllClearances] = useState(false);
  const [resume, setResume] = useState('');

  // Compact vehicle details row
  const [seatsAvail, setSeatsAvail] = useState<1 | 2 | 3>(1);
  const [bootSpace, setBootSpace] = useState<BootSpace>('Medium');
  const [canCarryAid, setCanCarryAid] = useState<'None' | 'Folding chair' | 'Walker' | 'Both'>('None');
  const [pickupRadiusKm, setPickupRadiusKm] = useState<5 | 10 | 20 | 30>(10);
  const [workerSuburb, setWorkerSuburb] = useState('');

  // Extras (optional)
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [abn, setAbn] = useState('');
  const [yearsExp, setYearsExp] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setShowErrors(false);
  }, [role]);

  /* persistence */
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const d = JSON.parse(raw);

      setRole(ROLE_OPTS.includes(d.role as Role) ? (d.role as Role) : 'Casual crew');

      setName(d.name ?? '');
      setEmail(d.email ?? '');
      setPhone(d.phone ?? '');

      setQualityBusinessName(d.qualityBusinessName ?? '');
      setQualityContributionTypes(Array.isArray(d.qualityContributionTypes) ? d.qualityContributionTypes : []);
      setQualityMessage(d.qualityMessage ?? '');

      setInnovationOrganisation(d.innovationOrganisation ?? '');
      setInnovationInterestAreas(Array.isArray(d.innovationInterestAreas) ? d.innovationInterestAreas : []);
      setInnovationNotes(d.innovationNotes ?? '');

      setAvailability(Array.isArray(d.availability) ? d.availability : []);
      setServices(Array.isArray(d.services) ? d.services : []);

      setNeedsTransport(Boolean(d.needsTransport));
      setPickupSuburb(d.pickupSuburb ?? '');
      setRideOptionsOpen(Boolean(d.rideOptionsOpen));
      setMaxRideMins([15, 30, 45, 60].includes(d.maxRideMins) ? d.maxRideMins : 30);
      setMobilityAidCrew(d.mobilityAidCrew ?? 'None');
      setRidePrefs(Array.isArray(d.ridePrefs) ? d.ridePrefs : []);

      setIsNDIS(Boolean(d.isNDIS));
      setFundingType(FUNDING_VALUES.includes(d.fundingType) ? d.fundingType : 'NDIS-managed');
      setNdisNumber(d.ndisNumber ?? '');
      setScContact(d.scContact ?? '');

      setCarCompliant(Boolean(d.carCompliant));
      setAllClearances(Boolean(d.allClearances));
      setResume(d.resume ?? '');

      setSeatsAvail([1, 2, 3].includes(d.seatsAvail) ? d.seatsAvail : 1);
      setBootSpace(d.bootSpace ?? 'Medium');
      setCanCarryAid(d.canCarryAid ?? 'None');
      setPickupRadiusKm([5, 10, 20, 30].includes(d.pickupRadiusKm) ? d.pickupRadiusKm : 10);
      setWorkerSuburb(d.workerSuburb ?? '');

      setExtrasOpen(Boolean(d.extrasOpen));
      setAbn(d.abn ?? '');
      setYearsExp(d.yearsExp === '' || typeof d.yearsExp === 'undefined' ? '' : Number(d.yearsExp));
      setNotes(d.notes ?? '');

      setConsent(Boolean(d.consent));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const d = {
        role,
        name,
        email,
        phone,
        qualityBusinessName,
        qualityContributionTypes,
        qualityMessage,
        innovationOrganisation,
        innovationInterestAreas,
        innovationNotes,
        availability,
        services,
        needsTransport,
        pickupSuburb,
        rideOptionsOpen,
        maxRideMins,
        mobilityAidCrew,
        ridePrefs,
        isNDIS,
        fundingType,
        ndisNumber,
        scContact,
        carCompliant,
        allClearances,
        resume,
        seatsAvail,
        bootSpace,
        canCarryAid,
        pickupRadiusKm,
        workerSuburb,
        extrasOpen,
        abn,
        yearsExp,
        notes,
        consent,
      };
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {}
  }, [
    role, name, email, phone, qualityBusinessName, qualityContributionTypes, qualityMessage,
    innovationOrganisation, innovationInterestAreas, innovationNotes, availability, services,
    needsTransport, pickupSuburb, rideOptionsOpen, maxRideMins, mobilityAidCrew, ridePrefs,
    isNDIS, fundingType, ndisNumber, scContact, carCompliant, allClearances, resume,
    seatsAvail, bootSpace, canCarryAid, pickupRadiusKm, workerSuburb, extrasOpen, abn, yearsExp, notes, consent,
  ]);

  /* validation */
  const scOk = !isCrew || !isNDIS || scContact.trim() === '' || isEmail(scContact) || isPhoneish(scContact);
  const workerCarOk = !isWorker || carCompliant;
  const workerClearancesOk = !isWorker || allClearances;
  const workerResumeOk = !isWorker || resume.trim().length > 0;
  const crewTransportOk = !isCrew || !needsTransport || pickupSuburb.trim().length > 0;
  const qualityBusinessOk = !isQualityPartner || qualityBusinessName.trim().length > 0;

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (!isEmail(email)) return false;
    if (!consent) return false;
    if (!isPartner && phone && !isPhoneish(phone)) return false;
    if (!scOk) return false;
    if (!workerCarOk) return false;
    if (!workerClearancesOk) return false;
    if (!workerResumeOk) return false;
    if (!crewTransportOk) return false;
    if (!qualityBusinessOk) return false;
    if (isWorker && abn && !isABNish(abn)) return false;
    return true;
  }, [name, email, consent, phone, isPartner, scOk, workerCarOk, workerClearancesOk, workerResumeOk, crewTransportOk, qualityBusinessOk, isWorker, abn]);

  /* submit */
  function buildBody() {
    const lines: string[] = [];
    lines.push('Role: ' + role);
    lines.push('Name: ' + name);
    lines.push('Email: ' + email);
    if (!isPartner && phone) lines.push('Phone: ' + phone);

    if (isCrew && needsTransport && pickupSuburb) lines.push('Suburb (pickup): ' + pickupSuburb);
    if (isWorker && workerSuburb) lines.push('Suburb: ' + workerSuburb);

    if (!isPartner && availability.length) lines.push('Availability: ' + availability.join(', '));
    if (!isPartner && services.length) lines.push('Work interests: ' + services.join(', '));

    if (isCrew) {
      lines.push('NDIS participant: ' + (isNDIS ? 'Yes' : 'No'));
      if (isNDIS) {
        const fundingLabel = FUNDING_CHOICES.find((choice) => choice.value === fundingType)?.label ?? fundingType;
        lines.push('Funding type: ' + fundingLabel);
        if (ndisNumber) lines.push('NDIS number (optional at EOI): ' + ndisNumber);
        if (scContact) lines.push('Coordinator contact: ' + scContact);
      }
      lines.push('Needs transport: ' + (needsTransport ? 'Yes' : 'No'));
      if (needsTransport) {
        if (pickupSuburb) lines.push('Pickup suburb/postcode: ' + pickupSuburb);
        lines.push('Max ride time (mins): ' + String(maxRideMins));
        lines.push('Mobility aid: ' + mobilityAidCrew);
        if (ridePrefs.length) lines.push('Ride preferences: ' + ridePrefs.join(', '));
      }
    } else if (isWorker) {
      lines.push('Car compliance (licence/rego/insurance): ' + (carCompliant ? 'Yes' : 'No'));
      lines.push('Required checks (NDIS/Blue Card/First Aid): ' + (allClearances ? 'Yes' : 'No'));
      if (resume.trim()) lines.push('Resume provided (text or link).');
      lines.push('Vehicle details: ' + `Seats ${seatsAvail} • Boot ${bootSpace} • Aids: ${canCarryAid} • Radius: ${pickupRadiusKm}km`);
      if (abn) lines.push('ABN (optional): ' + abn);
      if (yearsExp !== '') lines.push('Years of experience: ' + String(yearsExp));
    } else if (isQualityPartner) {
      lines.push('Business name: ' + qualityBusinessName);
      if (qualityContributionTypes.length) lines.push('Contribution types: ' + qualityContributionTypes.join(', '));
      if (qualityMessage.trim()) lines.push('Message: ' + qualityMessage.trim());
    } else if (isInnovationPartner) {
      if (innovationOrganisation.trim()) lines.push('Organisation: ' + innovationOrganisation.trim());
      if (innovationInterestAreas.length) lines.push('Interest areas: ' + innovationInterestAreas.join(', '));
      if (innovationNotes.trim()) lines.push('Notes: ' + innovationNotes.trim());
    }

    if (!isPartner && notes) lines.push('Notes: ' + notes);
    lines.push('');
    lines.push('I consent to Buds at Work contacting me about suitable opportunities.');
    return enc(lines.join('\r\n'));
  }

  function openEmailDraft() {
    if (!canSubmit) {
      setShowErrors(true);
      return;
    }
    const subject = enc('Expression of interest');
    const body = buildBody();
    window.location.href = `mailto:hello@budsatwork.com?subject=${subject}&body=${body}`;
  }

  function copyDraft() {
    try {
      const text = decodeURIComponent(buildBody());
      if (typeof navigator === 'undefined') return;
      navigator.clipboard?.writeText?.(text);
    } catch {}
  }

  /* styles */
  const labelCls = 'text-sm font-medium text-slate-800';
  const helpCls = 'text-xs text-slate-500 leading-relaxed';
  const inputCls = 'mt-1.5 w-full rounded-xl border bg-white/80 backdrop-blur px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1';
  const chip = cx(
    ui.radius.chip,
    'flex min-h-[44px] items-center justify-center px-4 py-2 border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2'
  );

  const showCrewSuburb = isCrew && needsTransport;
  const showWorkerSuburb = isWorker;
  const roleMeta = ROLE_META[role];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(900px circle at 20% 5%, rgba(20,83,45,0.12) 0, transparent 50%), radial-gradient(1000px circle at 85% 20%, rgba(125,211,252,0.14) 0, transparent 50%), radial-gradient(800px circle at 40% 80%, rgba(191,232,209,0.18) 0, transparent 55%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-6 md:px-8 py-12 md:py-16 space-y-12">
        {/* Hero */}
        <header className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
            <span className="h-2 w-2 rounded-full" style={{ background: brand.primary }} />
            <span style={{ color: brand.primary }}>Join us</span>
            <span className="text-slate-600">Four ways to get involved</span>
          </div>

          <h1
            className="mt-6 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1]"
            style={{ color: brand.text }}
          >
            Work with purpose.
            <span className="block" style={{ color: brand.primary }}>
              Make a difference.
            </span>
          </h1>

          <p className="mt-5 text-base md:text-lg leading-relaxed max-w-2xl" style={{ color: brand.muted }}>
            {"Whether you want paid work, to support others, or to help us improve — there's a place for you at Buds at Work. Choose your path below and we'll guide you through."}
          </p>
        </header>

        {/* Role Selection Cards */}
        <section>
          <div className="text-sm font-semibold mb-4" style={{ color: brand.text }}>
            Choose how you want to be involved
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROLE_OPTS.map((r) => {
              const meta = ROLE_META[r];
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cx(
                    'group relative rounded-3xl p-5 text-left transition-all border backdrop-blur',
                    active
                      ? 'bg-white/90 border-black/20 shadow-[0_20px_50px_rgba(20,83,45,0.15)]'
                      : 'bg-white/60 border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.06)] hover:bg-white/80 hover:shadow-[0_16px_40px_rgba(2,6,23,0.1)]'
                  )}
                >
                  {active && (
                    <div
                      className="absolute top-3 right-3 rounded-full p-1"
                      style={{ backgroundColor: brand.primary }}
                    >
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={cx(
                      'inline-flex rounded-2xl p-3 transition-colors',
                      active ? 'bg-white shadow-sm' : 'bg-white/70'
                    )}
                    style={{ color: brand.primary }}
                  >
                    {meta.icon}
                  </div>
                  <div className="mt-4">
                    <div className="text-base font-semibold" style={{ color: brand.text }}>
                      {meta.title}
                    </div>
                    <div className="text-xs font-medium mt-0.5" style={{ color: brand.primary }}>
                      {meta.tagline}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Selected Role Info */}
            <div className={cx('rounded-3xl p-6', glass)}>
              <div className="flex items-start gap-4">
                <IconWrap size="lg">{roleMeta.icon}</IconWrap>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold" style={{ color: brand.text }}>
                    {roleMeta.title}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: brand.muted }}>
                    {roleMeta.description}
                  </p>
                  <ul className="mt-4 grid sm:grid-cols-3 gap-2">
                    {roleMeta.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: brand.primary }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Your Details Section */}
            <div className={cx('rounded-3xl p-6', glassSoft)}>
              <div className="flex items-center gap-3 mb-6">
                <IconWrap size="sm"><UserIcon /></IconWrap>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: brand.text }}>Your details</h3>
                  <p className="text-xs text-slate-500">{"We'll use this to get in touch"}</p>
                </div>
              </div>

              <div className="grid gap-5">
                <div>
                  <label className={labelCls}>
                    Full name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jackson Taylor"
                    className={inputCls}
                    style={{
                      borderColor: showErrors && !name.trim() ? '#ef4444' : brand.border,
                      outlineColor: brand.focus,
                    }}
                  />
                </div>

                <div className={cx('grid gap-5', !isPartner && 'sm:grid-cols-2')}>
                  <div>
                    <label className={labelCls}>
                      Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com"
                      inputMode="email"
                      className={inputCls}
                      style={{
                        borderColor: showErrors && !isEmail(email) ? '#ef4444' : brand.border,
                        outlineColor: brand.focus,
                      }}
                    />
                  </div>
                  {!isPartner && (
                    <div>
                      <label className={labelCls}>Phone <span className="text-slate-400">(optional)</span></label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 04xx xxx xxx"
                        inputMode="tel"
                        className={inputCls}
                        style={{
                          borderColor: showErrors && phone && !isPhoneish(phone) ? '#ef4444' : brand.border,
                          outlineColor: brand.focus,
                        }}
                      />
                    </div>
                  )}
                </div>

                {showCrewSuburb && (
                  <div>
                    <label className={labelCls}>
                      Pickup location <span className="text-rose-500">*</span>
                    </label>
                    <p className={helpCls}>Where should we pick you up from?</p>
                    <input
                      value={pickupSuburb}
                      onChange={(e) => setPickupSuburb(e.target.value)}
                      placeholder="e.g. Flagstone 4280"
                      className={inputCls}
                      style={{
                        borderColor: showErrors && needsTransport && !pickupSuburb.trim() ? '#ef4444' : brand.border,
                        outlineColor: brand.focus,
                      }}
                    />
                  </div>
                )}

                {showWorkerSuburb && (
                  <div>
                    <label className={labelCls}>Your suburb</label>
                    <input
                      value={workerSuburb}
                      onChange={(e) => setWorkerSuburb(e.target.value)}
                      placeholder="e.g. Park Ridge, QLD"
                      className={inputCls}
                      style={{ borderColor: brand.border, outlineColor: brand.focus }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Availability & Services (Crew + Worker) */}
            {!isPartner && (
              <div className={cx('rounded-3xl p-6', glassSoft)}>
                <div className="flex items-center gap-3 mb-6">
                  <IconWrap size="sm"><CalendarIcon /></IconWrap>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: brand.text }}>When and what</h3>
                    <p className="text-xs text-slate-500">Choose up to 2 each</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={labelCls}>Availability</span>
                      <span className="text-xs text-slate-500 tabular-nums">{availability.length}/2</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {AVAIL_OPTS.map((opt) => {
                        const active = availability.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleLimited(availability, opt, setAvailability, 2)}
                            className={chip}
                            style={{
                              borderColor: active ? 'transparent' : brand.border,
                              backgroundColor: active ? '#0F3D2E' : 'white',
                              color: active ? 'white' : brand.muted,
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={labelCls}>Work interests</span>
                      <span className="text-xs text-slate-500 tabular-nums">{services.length}/2</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_OPTS.map((s) => {
                        const active = services.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleLimited(services, s, setServices, 2)}
                            className={chip}
                            style={{
                              borderColor: active ? 'transparent' : brand.border,
                              backgroundColor: active ? '#0F3D2E' : 'white',
                              color: active ? 'white' : brand.muted,
                            }}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Crew: NDIS & Transport */}
            {isCrew && (
              <div className={cx('rounded-3xl p-6', glassSoft)}>
                <div className="flex items-center gap-3 mb-6">
                  <IconWrap size="sm"><CarIcon /></IconWrap>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: brand.text }}>Support & transport</h3>
                    <p className="text-xs text-slate-500">Optional info that helps us plan</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* NDIS */}
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isNDIS}
                        onChange={(e) => setIsNDIS(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
                      />
                      <span className={labelCls}>I am an NDIS participant</span>
                    </label>

                    {isNDIS && (
                      <div className="ml-8 grid md:grid-cols-3 gap-4 pt-2">
                        <div>
                          <label className={labelCls}>Funding type</label>
                          <select
                            value={fundingType}
                            onChange={(e) => setFundingType(e.target.value as FundingType)}
                            className={inputCls}
                            style={{ borderColor: brand.border }}
                          >
                            {FUNDING_CHOICES.map((choice) => (
                              <option key={choice.value} value={choice.value}>{choice.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>NDIS number <span className="text-slate-400">(optional)</span></label>
                          <input
                            value={ndisNumber}
                            onChange={(e) => setNdisNumber(e.target.value)}
                            placeholder="Provide now or later"
                            className={inputCls}
                            style={{ borderColor: brand.border }}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Coordinator contact</label>
                          <input
                            value={scContact}
                            onChange={(e) => setScContact(e.target.value)}
                            placeholder="Email or phone"
                            className={inputCls}
                            style={{
                              borderColor: showErrors && !(scContact.trim() === '' || isEmail(scContact) || isPhoneish(scContact)) ? '#ef4444' : brand.border,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transport */}
                  <div className="space-y-4">
                    <div>
                      <span className={labelCls}>Do you need help getting to jobs?</span>
                      <div className="mt-2 flex gap-2">
                        {[true, false].map((val) => {
                          const active = needsTransport === val;
                          return (
                            <button
                              key={String(val)}
                              type="button"
                              onClick={() => setNeedsTransport(val)}
                              className={chip}
                              style={{
                                borderColor: active ? 'transparent' : brand.border,
                                backgroundColor: active ? '#0F3D2E' : 'white',
                                color: active ? 'white' : brand.muted,
                              }}
                            >
                              {val ? 'Yes, I need transport' : 'No, I can get there'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {needsTransport && (
                      <div className="space-y-4">
                        <button
                          type="button"
                          onClick={() => setRideOptionsOpen((v) => !v)}
                          className="text-sm font-medium underline underline-offset-4"
                          style={{ color: brand.primary }}
                        >
                          {rideOptionsOpen ? 'Hide ride preferences' : 'Set ride preferences (optional)'}
                        </button>

                        {rideOptionsOpen && (
                          <div className="grid md:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/50">
                            <div>
                              <label className={labelCls}>Max ride time</label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {[15, 30, 45, 60].map((m) => {
                                  const active = maxRideMins === m;
                                  return (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => setMaxRideMins(m as 15 | 30 | 45 | 60)}
                                      className="px-3 py-1.5 text-sm border rounded-full transition-colors"
                                      style={{
                                        borderColor: active ? 'transparent' : brand.border,
                                        backgroundColor: active ? '#0F3D2E' : 'white',
                                        color: active ? 'white' : brand.muted,
                                      }}
                                    >
                                      {m} min
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <label className={labelCls}>Mobility aid</label>
                              <select
                                className={inputCls}
                                style={{ borderColor: brand.border }}
                                value={mobilityAidCrew}
                                onChange={(e) => setMobilityAidCrew(e.target.value as MobilityAid)}
                              >
                                {['None', 'Folding chair', 'Walker', 'Other'].map((o) => (
                                  <option key={o}>{o}</option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className={labelCls}>Ride preferences</label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {['Quiet', 'No strong smells', 'Seat near door'].map((p) => {
                                  const active = ridePrefs.includes(p);
                                  return (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setRidePrefs(active ? ridePrefs.filter((x) => x !== p) : [...ridePrefs, p])}
                                      className="px-3 py-1.5 text-sm border rounded-full transition-colors"
                                      style={{
                                        borderColor: active ? 'transparent' : brand.border,
                                        backgroundColor: active ? '#0F3D2E' : 'white',
                                        color: active ? 'white' : brand.muted,
                                      }}
                                    >
                                      {p}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Support Worker Section */}
            {isWorker && (
              <div className={cx('rounded-3xl p-6', glassSoft)}>
                <div className="flex items-center gap-3 mb-6">
                  <IconWrap size="sm"><ShieldCheckIcon /></IconWrap>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: brand.text }}>Safety & vehicle</h3>
                    <p className="text-xs text-slate-500">Quick checks before we match you</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-white/50 border border-transparent hover:border-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={carCompliant}
                      onChange={(e) => setCarCompliant(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-800">My car is safe and legal</span>
                      <p className="text-xs text-slate-500 mt-0.5">Licensed, registered, and insured for work</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-white/50 border border-transparent hover:border-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={allClearances}
                      onChange={(e) => setAllClearances(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-800">I have required checks</span>
                      <p className="text-xs text-slate-500 mt-0.5">NDIS screening, Blue Card/WWCC, First Aid/CPR</p>
                    </div>
                  </label>

                  <div>
                    <label className={labelCls}>
                      Resume <span className="text-rose-500">*</span>
                    </label>
                    <p className={helpCls}>Paste your resume or add a link (Drive, Dropbox, etc.)</p>
                    <textarea
                      value={resume}
                      onChange={(e) => setResume(e.target.value)}
                      rows={4}
                      placeholder="Paste your resume or a public link..."
                      className={inputCls}
                      style={{
                        borderColor: showErrors && resume.trim() === '' ? '#ef4444' : brand.border,
                        outlineColor: brand.focus,
                      }}
                    />
                  </div>

                  {/* Vehicle Details */}
                  <div className="p-4 rounded-2xl bg-white/60 border border-black/10">
                    <div className="text-sm font-medium text-slate-800 mb-3">Vehicle details</div>
                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-slate-600">Available seats</label>
                        <div className="mt-1.5 flex gap-1">
                          {[1, 2, 3].map((n) => {
                            const active = seatsAvail === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setSeatsAvail(n as 1 | 2 | 3)}
                                className="flex-1 py-2 text-sm border rounded-lg transition-colors"
                                style={{
                                  borderColor: active ? 'transparent' : brand.border,
                                  backgroundColor: active ? '#0F3D2E' : 'white',
                                  color: active ? 'white' : brand.muted,
                                }}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600">Boot space</label>
                        <select
                          className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                          style={{ borderColor: brand.border }}
                          value={bootSpace}
                          onChange={(e) => setBootSpace(e.target.value as BootSpace)}
                        >
                          {(['Small', 'Medium', 'Large'] as BootSpace[]).map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600">Can carry aids</label>
                        <select
                          className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm bg-white"
                          style={{ borderColor: brand.border }}
                          value={canCarryAid}
                          onChange={(e) => setCanCarryAid(e.target.value as any)}
                        >
                          {['None', 'Folding chair', 'Walker', 'Both'].map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600">Pickup radius</label>
                        <div className="mt-1.5 flex gap-1">
                          {[5, 10, 20, 30].map((km) => {
                            const active = pickupRadiusKm === km;
                            return (
                              <button
                                key={km}
                                type="button"
                                onClick={() => setPickupRadiusKm(km as 5 | 10 | 20 | 30)}
                                className="flex-1 py-2 text-xs border rounded-lg transition-colors"
                                style={{
                                  borderColor: active ? 'transparent' : brand.border,
                                  backgroundColor: active ? '#0F3D2E' : 'white',
                                  color: active ? 'white' : brand.muted,
                                }}
                              >
                                {km}km
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Optional extras */}
                  <button
                    type="button"
                    onClick={() => setExtrasOpen((v) => !v)}
                    className="text-sm font-medium underline underline-offset-4"
                    style={{ color: brand.primary }}
                  >
                    {extrasOpen ? 'Hide optional fields' : 'Add ABN & experience (optional)'}
                  </button>

                  {extrasOpen && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>ABN</label>
                        <input
                          value={abn}
                          onChange={(e) => setAbn(e.target.value)}
                          placeholder="11 111 111 111"
                          className={inputCls}
                          style={{ borderColor: isABNish(abn) ? brand.border : '#ef4444' }}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Years of experience</label>
                        <input
                          value={yearsExp === '' ? '' : String(yearsExp)}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') setYearsExp('');
                            else if (/^\d{0,2}$/.test(v)) setYearsExp(Number(v));
                          }}
                          inputMode="numeric"
                          placeholder="e.g. 2"
                          className={inputCls}
                          style={{ borderColor: brand.border }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelCls}>Anything else?</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          placeholder="Strengths, constraints, ideal days..."
                          className={inputCls}
                          style={{ borderColor: brand.border }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quality Partner */}
            {isQualityPartner && (
              <div className={cx('rounded-3xl p-6', glassSoft)}>
                <div className="flex items-center gap-3 mb-6">
                  <IconWrap size="sm"><BadgeCheckIcon /></IconWrap>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: brand.text }}>How you want to help</h3>
                    <p className="text-xs text-slate-500">Share advice, tips, or feedback</p>
                  </div>
                </div>
                <QualityPartnerForm
                  businessName={qualityBusinessName}
                  setBusinessName={setQualityBusinessName}
                  contributionTypes={qualityContributionTypes}
                  setContributionTypes={setQualityContributionTypes}
                  message={qualityMessage}
                  setMessage={setQualityMessage}
                  showErrors={showErrors}
                  chipClassName={chip}
                  labelClassName={labelCls}
                  helpClassName={helpCls}
                />
              </div>
            )}

            {/* Innovation Partner */}
            {isInnovationPartner && (
              <div className={cx('rounded-3xl p-6', glassSoft)}>
                <div className="flex items-center gap-3 mb-6">
                  <IconWrap size="sm"><LightbulbIcon /></IconWrap>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: brand.text }}>{"What you're interested in"}</h3>
                    <p className="text-xs text-slate-500">{"Tell us what you'd like to explore"}</p>
                  </div>
                </div>
                <InnovationPartnerForm
                  organisation={innovationOrganisation}
                  setOrganisation={setInnovationOrganisation}
                  interestAreas={innovationInterestAreas}
                  setInterestAreas={setInnovationInterestAreas}
                  notes={innovationNotes}
                  setNotes={setInnovationNotes}
                  chipClassName={chip}
                  labelClassName={labelCls}
                  helpClassName={helpCls}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className={cx('rounded-3xl p-6 sticky top-6', glass)}>
              <div className="flex items-center gap-3 mb-4">
                <IconWrap size="sm"><MailIcon /></IconWrap>
                <h2 className="text-lg font-semibold" style={{ color: brand.text }}>
                  Send your details
                </h2>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                No accounts needed. This form creates a ready-to-send email.
              </p>

              {/* Status indicator */}
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium mb-5"
                style={{
                  borderColor: canSubmit ? '#16a34a40' : '#f59e0b40',
                  backgroundColor: canSubmit ? '#16a34a10' : '#f59e0b10',
                  color: canSubmit ? '#15803d' : '#b45309',
                }}
              >
                <span
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: canSubmit ? '#16a34a' : '#f59e0b' }}
                />
                {canSubmit ? 'Ready to send' : 'Complete required fields'}
              </div>

              {/* Steps */}
              <ol className="space-y-3 mb-5">
                {[
                  { step: 1, text: 'Fill in the form above' },
                  { step: 2, text: 'Click to open or copy your email' },
                  { step: 3, text: 'Send to hello@budsatwork.com' },
                ].map(({ step, text }) => (
                  <li key={step} className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ backgroundColor: '#0F3D2E15', color: brand.primary }}
                    >
                      {step}
                    </span>
                    <span className="text-sm text-slate-700 pt-0.5">{text}</span>
                  </li>
                ))}
              </ol>

              {/* Errors */}
              {showErrors && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 space-y-1">
                  {!name.trim() && <p>• Add your full name</p>}
                  {!isEmail(email) && <p>• Add a valid email</p>}
                  {!isPartner && phone && !isPhoneish(phone) && <p>• Fix phone number or leave blank</p>}
                  {isCrew && needsTransport && !pickupSuburb.trim() && <p>• Add your pickup location</p>}
                  {isCrew && isNDIS && !(scContact.trim() === '' || isEmail(scContact) || isPhoneish(scContact)) && (
                    <p>• Coordinator contact must be valid</p>
                  )}
                  {isWorker && !carCompliant && <p>• Confirm your car is safe and legal</p>}
                  {isWorker && !allClearances && <p>• Confirm you have required checks</p>}
                  {isWorker && resume.trim() === '' && <p>• Add your resume or a link</p>}
                  {isWorker && abn && !isABNish(abn) && <p>• ABN should be 11 digits</p>}
                  {isQualityPartner && !qualityBusinessName.trim() && <p>• Add your business name</p>}
                  {!consent && <p>• Tick the consent checkbox</p>}
                </div>
              )}

              {/* Consent */}
              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
                />
                <span className="text-sm text-slate-700">
                  {"It's okay for Buds at Work to contact me about work or opportunities."}
                </span>
              </label>

              {/* Actions */}
              <div className="grid gap-3">
                <button
                  onClick={openEmailDraft}
                  className="w-full py-3.5 px-5 rounded-2xl font-semibold text-white shadow-[0_12px_30px_rgba(20,83,45,0.25)] transition-all hover:shadow-[0_16px_40px_rgba(20,83,45,0.3)] active:scale-[0.98]"
                  style={{ backgroundColor: brand.primary }}
                >
                  Open email draft
                </button>
                <button
                  type="button"
                  onClick={copyDraft}
                  className="w-full py-3 px-5 rounded-2xl font-semibold border bg-white/70 backdrop-blur hover:bg-white transition-colors"
                  style={{ borderColor: brand.border, color: brand.text }}
                >
                  Copy to clipboard
                </button>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                If nothing opens, paste the copied text into an email to{' '}
                <a href="mailto:hello@budsatwork.com" className="underline underline-offset-2">
                  hello@budsatwork.com
                </a>
              </p>

              <div className="mt-6 pt-5 border-t border-black/10">
                <p className="text-xs text-slate-500">
                  We only keep what we need and never sell your details. Ask us to delete them anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
