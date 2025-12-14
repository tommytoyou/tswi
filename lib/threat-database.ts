// ============================================================================
// THREAT CHARACTERIZATION DATABASE
// Known Inspector/Proximity Operations (RPO) Satellites
// ============================================================================

export type ThreatLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type OrbitType = 'LEO' | 'MEO' | 'GEO' | 'HEO';
export type ThreatCountry = 'Russia' | 'China';

export interface ObservedBehavior {
  date?: string;
  description: string;
  target?: string;
}

export interface ThreatSatellite {
  noradId: number;
  name: string;
  aliases?: string[];
  country: ThreatCountry;
  orbitType: OrbitType;
  launchDate?: string;
  capabilities: string[];
  observedBehaviors: ObservedBehavior[];
  threatLevel: ThreatLevel;
  sources: string[];
  notes?: string;
}

// ============================================================================
// RUSSIAN INSPECTOR/RPO ASSETS
// ============================================================================

const COSMOS_2542: ThreatSatellite = {
  noradId: 47852,
  name: 'COSMOS 2542',
  aliases: ['Kosmos 2542', 'Nivelir'],
  country: 'Russia',
  orbitType: 'LEO',
  launchDate: '2019-11-25',
  capabilities: [
    'Optical inspection sensors',
    'Sub-satellite deployment (COSMOS 2543)',
    'Rendezvous and proximity operations',
    'Orbital maneuvering for target tracking',
    'Multi-month sustained proximity operations',
  ],
  observedBehaviors: [
    {
      date: '2020-01',
      description: 'Deployed sub-satellite COSMOS 2543',
    },
    {
      date: '2020-01',
      description: 'Conducted RPO approach to USA 245 (KH-11 reconnaissance satellite)',
      target: 'USA 245 (NORAD 37348)',
    },
    {
      date: '2020-02',
      description: 'Maintained sustained proximity to USA 245 for several weeks',
      target: 'USA 245',
    },
    {
      date: '2020-07',
      description: 'COSMOS 2543 released object into orbit (potential projectile test)',
    },
  ],
  threatLevel: 'HIGH',
  sources: [
    'Space Force 18th Space Defense Squadron tracking data',
    'Secure World Foundation - Global Counterspace Capabilities Report 2023',
    'CSIS Aerospace Security Project analysis',
    'Amateur satellite tracking community (SeeSat-L)',
  ],
  notes: 'Part of Russian Nivelir program. First confirmed Russian inspector satellite to approach a US national security satellite. COSMOS 2543 demonstrated projectile release capability.',
};

const COSMOS_2543: ThreatSatellite = {
  noradId: 45916,
  name: 'COSMOS 2543',
  aliases: ['Kosmos 2543'],
  country: 'Russia',
  orbitType: 'LEO',
  launchDate: '2020-01-01', // Deployed from COSMOS 2542
  capabilities: [
    'Inspector sub-satellite',
    'Close approach maneuvering',
    'Object release/projectile capability',
    'Independent orbital control',
  ],
  observedBehaviors: [
    {
      date: '2020-01',
      description: 'Deployed from parent satellite COSMOS 2542',
    },
    {
      date: '2020-07-15',
      description: 'Released an object into orbit while near another Russian satellite (Cosmos 2535)',
      target: 'Cosmos 2535',
    },
    {
      date: '2020-07',
      description: 'US Space Command characterized event as potential weapons test',
    },
  ],
  threatLevel: 'HIGH',
  sources: [
    'US Space Command official statement (July 2020)',
    'Space Force tracking data',
    'Secure World Foundation reports',
  ],
  notes: 'Sub-satellite deployed from COSMOS 2542. Demonstrated ability to release objects in orbit, described by US Space Command as consistent with on-orbit weapons test.',
};

const COSMOS_2558: ThreatSatellite = {
  noradId: 49944,
  name: 'COSMOS 2558',
  aliases: ['Kosmos 2558'],
  country: 'Russia',
  orbitType: 'LEO',
  launchDate: '2022-08-01',
  capabilities: [
    'Inspector satellite',
    'Orbital plane matching',
    'Sustained proximity operations',
    'Optical/signals intelligence collection suspected',
  ],
  observedBehaviors: [
    {
      date: '2022-08',
      description: 'Launched into orbital plane matching USA 326 (classified NRO satellite)',
      target: 'USA 326 (NORAD 51445)',
    },
    {
      date: '2022-09',
      description: 'Established trailing position behind USA 326',
      target: 'USA 326',
    },
    {
      date: '2022-10',
      description: 'Maintained consistent proximity to USA 326 for extended period',
      target: 'USA 326',
    },
  ],
  threatLevel: 'HIGH',
  sources: [
    'Space Force 18th Space Defense Squadron',
    'Harvard-Smithsonian Center for Astrophysics analysis',
    'Amateur tracking community observations',
    'Secure World Foundation - Global Counterspace Capabilities 2023',
  ],
  notes: 'Launched specifically to monitor USA 326. Demonstrates Russian capability to rapidly deploy inspector satellites targeting specific US national security assets.',
};

const LUCH_OLYMP_1: ThreatSatellite = {
  noradId: 40258,
  name: 'Luch (Olymp-K)',
  aliases: ['Olymp 1', 'Luch 5V', 'OLYMP'],
  country: 'Russia',
  orbitType: 'GEO',
  launchDate: '2014-09-28',
  capabilities: [
    'GEO station repositioning',
    'Signals intelligence (SIGINT) collection',
    'Proximity operations in GEO belt',
    'Long-duration loitering near targets',
  ],
  observedBehaviors: [
    {
      date: '2014-10',
      description: 'Positioned near Intelsat commercial satellites',
      target: 'Intelsat satellites',
    },
    {
      date: '2015',
      description: 'Relocated to position between Intelsat 7 and Intelsat 901',
      target: 'Intelsat 7, Intelsat 901',
    },
    {
      date: '2016-2017',
      description: 'Multiple GEO station changes, drifting through commercial satellite belt',
    },
    {
      date: '2017',
      description: 'Positioned near French-Italian military satellite Athena-Fidus',
      target: 'Athena-Fidus',
    },
    {
      date: '2018-2023',
      description: 'Continued pattern of repositioning near various GEO satellites',
    },
  ],
  threatLevel: 'HIGH',
  sources: [
    'French Ministry of Defense statement (2018)',
    'Space Data Association observations',
    'AGI/Analytical Graphics commercial tracking',
    'Secure World Foundation reports',
  ],
  notes: 'First confirmed Russian GEO inspector. Pattern of behavior strongly suggests SIGINT collection against commercial and military GEO satellites. French government publicly accused Russia of espionage.',
};

const LUCH_OLYMP_2: ThreatSatellite = {
  noradId: 43432,
  name: 'Luch (Olymp-K2)',
  aliases: ['Olymp 2', 'Luch 5X'],
  country: 'Russia',
  orbitType: 'GEO',
  launchDate: '2018-03-29',
  capabilities: [
    'GEO station repositioning',
    'SIGINT collection',
    'Proximity operations',
    'Long-endurance operations',
  ],
  observedBehaviors: [
    {
      date: '2018-04',
      description: 'Entered GEO belt and began repositioning maneuvers',
    },
    {
      date: '2019',
      description: 'Multiple station changes observed near various GEO assets',
    },
    {
      date: '2020-2023',
      description: 'Continued pattern consistent with first Luch/Olymp satellite',
    },
  ],
  threatLevel: 'HIGH',
  sources: [
    'Space-Track.org tracking data',
    'Commercial satellite operators reports',
    'Secure World Foundation analysis',
  ],
  notes: 'Second Luch/Olymp series satellite. Continues mission profile of first Olymp with GEO repositioning and suspected SIGINT operations.',
};

// ============================================================================
// CHINESE INSPECTOR/RPO ASSETS
// ============================================================================

const SJ_21: ThreatSatellite = {
  noradId: 49502,
  name: 'SJ-21',
  aliases: ['Shijian-21', 'SJ-21A'],
  country: 'China',
  orbitType: 'GEO',
  launchDate: '2021-10-23',
  capabilities: [
    'Robotic arm for debris capture',
    'GEO proximity operations',
    'Object grappling and repositioning',
    'Active debris removal demonstration',
    'On-orbit servicing potential',
  ],
  observedBehaviors: [
    {
      date: '2022-01-22',
      description: 'Grappled defunct Beidou-2 G2 navigation satellite and relocated it to graveyard orbit',
      target: 'Beidou-2 G2 (NORAD 36590)',
    },
    {
      date: '2022-01',
      description: 'Demonstrated precision approach and capture in GEO',
      target: 'Beidou-2 G2',
    },
    {
      date: '2022-2023',
      description: 'Continued orbital operations in GEO belt',
    },
  ],
  threatLevel: 'HIGH',
  sources: [
    'ExoAnalytic Solutions tracking',
    'Space Force 18th Space Defense Squadron',
    'Center for Strategic and International Studies (CSIS)',
    'Secure World Foundation - Global Counterspace Capabilities 2023',
  ],
  notes: 'First confirmed satellite to grapple another object in GEO. While officially for debris cleanup, demonstrated dual-use capability applicable to hostile capture of adversary satellites.',
};

const SJ_23: ThreatSatellite = {
  noradId: 52939,
  name: 'SJ-23',
  aliases: ['Shijian-23'],
  country: 'China',
  orbitType: 'GEO',
  launchDate: '2023-01-09',
  capabilities: [
    'GEO proximity operations (suspected)',
    'Follow-on to SJ-21 mission profile',
    'Potential robotic manipulation',
    'On-orbit servicing capabilities (suspected)',
  ],
  observedBehaviors: [
    {
      date: '2023-01',
      description: 'Launched to GEO, initial orbital operations began',
    },
    {
      date: '2023-02',
      description: 'Observed maneuvering in GEO belt',
    },
    {
      date: '2023',
      description: 'Pattern of operations suggests similar capabilities to SJ-21',
    },
  ],
  threatLevel: 'MEDIUM',
  sources: [
    'Space-Track.org catalog',
    'ExoAnalytic Solutions observations',
    'Amateur satellite tracking community',
  ],
  notes: 'Follow-on mission to SJ-21. Specific capabilities not yet publicly demonstrated but presumed similar to predecessor based on mission profile.',
};

const SJ_17: ThreatSatellite = {
  noradId: 41838,
  name: 'SJ-17',
  aliases: ['Shijian-17'],
  country: 'China',
  orbitType: 'GEO',
  launchDate: '2016-11-03',
  capabilities: [
    'Robotic arm for on-orbit operations',
    'GEO maneuvering',
    'Close proximity operations',
    'Technology demonstration platform',
  ],
  observedBehaviors: [
    {
      date: '2016-11',
      description: 'Launched to GEO as space environment monitoring satellite',
    },
    {
      date: '2017',
      description: 'Performed multiple repositioning maneuvers in GEO',
    },
    {
      date: '2018',
      description: 'Approached within close proximity of other GEO objects',
    },
  ],
  threatLevel: 'MEDIUM',
  sources: [
    'China Aerospace Science and Technology Corporation (CASC)',
    'Space-Track.org',
    'Secure World Foundation analysis',
  ],
  notes: 'Earlier generation Chinese GEO inspector. Equipped with robotic arm. Precursor technology demonstrator for SJ-21 capabilities.',
};

const AOLONG_1: ThreatSatellite = {
  noradId: 41628,
  name: 'Aolong-1',
  aliases: ['Roaming Dragon', 'ADRV'],
  country: 'China',
  orbitType: 'LEO',
  launchDate: '2016-06-25',
  capabilities: [
    'Robotic arm for debris capture',
    'Active debris removal technology',
    'Close proximity operations',
    'Object grappling demonstration',
  ],
  observedBehaviors: [
    {
      date: '2016-06',
      description: 'Launched as debris cleanup technology demonstrator',
    },
    {
      date: '2016-2017',
      description: 'Conducted multiple proximity and approach maneuvers',
    },
  ],
  threatLevel: 'MEDIUM',
  sources: [
    'China National Space Administration (CNSA)',
    'Secure World Foundation reports',
    'Space-Track.org',
  ],
  notes: 'Early Chinese LEO inspector/debris capture demonstrator. Equipped with robotic arm. Dual-use concerns due to potential for hostile satellite capture.',
};

// ============================================================================
// COMPLETE THREAT DATABASE
// ============================================================================

export const THREAT_DATABASE: ThreatSatellite[] = [
  // Russian Assets
  COSMOS_2542,
  COSMOS_2543,
  COSMOS_2558,
  LUCH_OLYMP_1,
  LUCH_OLYMP_2,
  // Chinese Assets
  SJ_21,
  SJ_23,
  SJ_17,
  AOLONG_1,
];

// Helper function to get satellites by country
export function getThreatsByCountry(country: ThreatCountry): ThreatSatellite[] {
  return THREAT_DATABASE.filter(sat => sat.country === country);
}

// Helper function to get satellites by threat level
export function getThreatsByLevel(level: ThreatLevel): ThreatSatellite[] {
  return THREAT_DATABASE.filter(sat => sat.threatLevel === level);
}

// Helper function to get satellites by orbit type
export function getThreatsByOrbit(orbit: OrbitType): ThreatSatellite[] {
  return THREAT_DATABASE.filter(sat => sat.orbitType === orbit);
}

// Helper to get a single satellite by NORAD ID
export function getThreatByNoradId(noradId: number): ThreatSatellite | undefined {
  return THREAT_DATABASE.find(sat => sat.noradId === noradId);
}

// Get summary statistics
export function getThreatSummary() {
  return {
    total: THREAT_DATABASE.length,
    byCountry: {
      Russia: getThreatsByCountry('Russia').length,
      China: getThreatsByCountry('China').length,
    },
    byThreatLevel: {
      HIGH: getThreatsByLevel('HIGH').length,
      MEDIUM: getThreatsByLevel('MEDIUM').length,
      LOW: getThreatsByLevel('LOW').length,
    },
    byOrbit: {
      LEO: getThreatsByOrbit('LEO').length,
      GEO: getThreatsByOrbit('GEO').length,
      MEO: getThreatsByOrbit('MEO').length,
      HEO: getThreatsByOrbit('HEO').length,
    },
  };
}
