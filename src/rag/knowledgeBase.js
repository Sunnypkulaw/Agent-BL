// TradeShield RAG Risk Intelligence Knowledge Base
// 28 entries across 7 MacroRiskEvent categories
// All entries connect to the Shanghai -> Hamburg shipping route (Indian Ocean / Suez Canal)

export const KNOWLEDGE_CATEGORIES = [
  'war_risk',
  'sanction_risk',
  'port_congestion',
  'severe_weather',
  'commodity_volatility',
  'fx_volatility',
  'buyer_country_risk'
];

const ROUTE_KEYWORDS = {
  'Shanghai->Hamburg': ['shanghai', 'hamburg', 'suez', 'indian ocean', 'red sea', 'mediterranean', 'north sea', 'east china sea', 'south china sea', 'singapore', 'rotterdam', 'pacific dawn']
};

export const KNOWLEDGE_BASE = [
  // ============================================================
  // Category 1: war_risk (4 entries)
  // ============================================================

  {
    id: 'WAR-001',
    category: 'war_risk',
    title: 'Houthi attacks on commercial vessels disrupt Red Sea and Suez Canal transit',
    summary: 'Ongoing Houthi attacks on commercial shipping in the southern Red Sea and Bab el-Mandeb strait have forced many carriers to reroute around the Cape of Good Hope, adding 10-14 days and $1M+ in additional fuel costs per voyage.',
    detail: 'Since late 2023, Iran-backed Houthi forces in Yemen have targeted commercial vessels transiting the Bab el-Mandeb strait with anti-ship missiles and drone attacks. Over 60 vessels have been attacked, resulting in at least 4 ships sunk and multiple crew casualties. Major carriers including Maersk, MSC, and CMA CGM have suspended Suez Canal transits and rerouted via the Cape of Good Hope. For a Shanghai-to-Hamburg voyage normally taking 28-32 days via Suez, the Cape route adds approximately 3,500 nautical miles, increasing transit time to 38-44 days and fuel costs by $0.8M to $1.5M per voyage. Insurance premiums for Red Sea transits have risen 5-10x, and war risk insurance is now mandatory for vessels transiting the region.',
    severity: 'critical',
    region: 'Red Sea / Yemen / Bab el-Mandeb',
    date: '2026-06-01',
    source: 'UN Security Council reports, Lloyd\'s List, ICS shipping advisories (mock)',
    keywords: ['houthi', 'red sea', 'suez', 'babelmandeb', 'missile', 'drone', 'reroute', 'cape of good hope', 'yemen', 'war risk insurance'],
    relevance: {
      routes: ['Shanghai->Hamburg', 'suez', 'red sea'],
      commodities: ['all']
    }
  },

  {
    id: 'WAR-002',
    category: 'war_risk',
    title: 'Sudan civil war escalates, threatening Red Sea shipping corridor stability',
    summary: 'Civil war escalation in Sudan raises concerns about Red Sea littoral stability. Port Sudan, a key emergency port for vessels avoiding Houthi attacks, is under increased military pressure, reducing safe haven options along the African Red Sea coast.',
    detail: 'The Sudanese civil war has intensified with fighting spreading toward the Red Sea coast. Port Sudan, the country\'s primary maritime gateway and a critical emergency port for vessels diverting from Houthi-threatened waters, faces growing instability. Satellite imagery shows military buildup within 100km of the port. Regional analysts warn that the conflict could cut off the last viable Red Sea resupply point between Suez and Djibouti. For copper cathode shipments from Shanghai to Hamburg, this means the Red Sea corridor has both northern (Houthi) and southern (Sudan) threat vectors, making the Cape route increasingly the default choice despite higher costs.',
    severity: 'warning',
    region: 'Sudan / Red Sea Coast / Port Sudan',
    date: '2026-05-15',
    source: 'African Union situation reports, maritime security bulletins (mock)',
    keywords: ['sudan', 'civil war', 'port sudan', 'red sea coast', 'military buildup', 'safe haven', 'african'],
    relevance: {
      routes: ['Shanghai->Hamburg', 'red sea'],
      commodities: ['all']
    }
  },

  {
    id: 'WAR-003',
    category: 'war_risk',
    title: 'Middle East tensions widen, raising war risk insurance premiums for Suez transit',
    summary: 'Escalating Israel-Iran tensions and broader Middle East instability have driven war risk insurance premiums for Suez Canal transit up by 300-500%, significantly increasing the cost of Red Sea routing for all cargo types.',
    detail: 'The spreading Middle East conflict has pushed war risk underwriters to reclassify the entire Red Sea region as a "high risk" zone. Additional premiums for hull war risks now range from 0.5% to 2.0% of vessel value per transit, up from 0.05%-0.1% pre-crisis. For a $50M vessel carrying $8M in copper cathodes, this translates to $250K-$1M in additional insurance costs per Suez transit. Some underwriters have begun excluding Red Sea transits entirely from standard policies, forcing carriers to purchase standalone war risk coverage. The London marine insurance market has designated the Red Sea south of 20°N latitude as a Listed Area requiring 7-day advance notice for all transits.',
    severity: 'warning',
    region: 'Middle East / Israel / Iran',
    date: '2026-05-28',
    source: 'Lloyd\'s Market Association, Joint War Committee circulars (mock)',
    keywords: ['israel', 'iran', 'middle east', 'war risk', 'insurance premium', 'lloyds', 'underwriters', 'listed area'],
    relevance: {
      routes: ['Shanghai->Hamburg', 'suez', 'red sea'],
      commodities: ['all']
    }
  },

  {
    id: 'WAR-004',
    category: 'war_risk',
    title: 'South China Sea naval exercises raise transit uncertainty for Asian export routes',
    summary: 'Large-scale naval exercises in the South China Sea involving multiple nations create temporary transit restrictions and AIS signal disruptions, affecting vessel departure schedules from Shanghai and other Chinese ports.',
    detail: 'Multi-national naval exercises in the South China Sea have led to temporary exclusion zones and recommended diversion routes for commercial shipping. Vessels departing Shanghai for the Malacca Strait must now transit through a narrower corridor, adding 0.5-1 day to departure schedules. AIS (Automatic Identification System) signals are sporadically jammed or spoofed in the region, creating documentation gaps for cargo insurers and financiers. While the direct risk to commercial vessels is low, the uncertainty affects departure reliability and schedule predictability — critical factors for eBL-backed trade finance where arrival timelines determine insurance coverage and financing duration.',
    severity: 'info',
    region: 'South China Sea',
    date: '2026-06-03',
    source: 'IMO navigation warnings, commercial shipping advisories (mock)',
    keywords: ['south china sea', 'naval exercise', 'military', 'ais', 'departure delay', 'shanghai', 'exclusion zone'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  // ============================================================
  // Category 2: sanction_risk (4 entries)
  // ============================================================

  {
    id: 'SAN-001',
    category: 'sanction_risk',
    title: 'OFAC Iran sanctions require enhanced vessel screening for all Suez/Middle East transits',
    summary: 'Expanded OFAC sanctions on Iran-linked entities mandate comprehensive vessel ownership screening. Any vessel that called at an Iranian port within the past 180 days requires enhanced due diligence and may face delays at Suez Canal authority checks.',
    detail: 'The U.S. Office of Foreign Assets Control (OFAC) maintains an expanding sanctions list targeting Iranian shipping entities, including IRISL (Islamic Republic of Iran Shipping Lines) and affiliated front companies. Under current regulations, any vessel with a history of Iranian port calls within 180 days faces mandatory screening at the Suez Canal. The Egyptian SCA has begun enforcing these checks more rigorously, resulting in 12-24 hour delays for flagged vessels. For trade finance, this means financiers must screen vessel ownership, flag state, and port call history before funding an eBL-backed transaction. A vessel that triggers sanctions screening could delay cargo by 3-5 days, pushing ETA beyond insurance expiry dates.',
    severity: 'warning',
    region: 'Iran / Persian Gulf / Suez Canal',
    date: '2026-05-20',
    source: 'OFAC advisories, Suez Canal Authority notices (mock)',
    keywords: ['ofac', 'iran', 'sanction', 'vessel screening', 'irisl', 'suez canal', 'port call history', 'ownership'],
    relevance: {
      routes: ['Shanghai->Hamburg', 'suez', 'persian gulf'],
      commodities: ['all']
    }
  },

  {
    id: 'SAN-002',
    category: 'sanction_risk',
    title: 'EU sanctions on Russian cargoes impact Black Sea rerouting options',
    summary: 'Expanded EU sanctions on Russia include restrictions on vessels that have carried Russian-origin cargoes. This affects alternative Black Sea routing options for vessels that might otherwise avoid the Red Sea by transiting through the Black Sea and overland corridors.',
    detail: 'The EU\'s 14th sanctions package against Russia extends cargo and vessel restrictions to any ship that has loaded Russian-origin commodities at Black Sea ports. For the Shanghai-to-Hamburg trade, this is relevant because some carriers have explored a "Northern Corridor" strategy — discharging at Black Sea ports (Romania, Bulgaria) and using rail to Central Europe — as an alternative to both Suez and Cape routes. However, sanctions compliance now requires full cargo traceability declarations. A copper cathode shipment from China must prove it contains no Russian-origin copper, which is complicated by the fact that Russia produces ~4% of global copper and Chinese smelters process significant volumes of Russian concentrate.',
    severity: 'critical',
    region: 'Russia / Black Sea / EU',
    date: '2026-06-01',
    source: 'EU Council regulations, European Commission trade advisories (mock)',
    keywords: ['eu sanction', 'russia', 'black sea', 'cargo restriction', 'copper origin', 'traceability', 'overland'],
    relevance: {
      routes: ['Shanghai->Hamburg', 'black sea'],
      commodities: ['copper', 'metals']
    }
  },

  {
    id: 'SAN-003',
    category: 'sanction_risk',
    title: 'UN sanctions on North Korea restrict shipping flag states and beneficial ownership',
    summary: 'UN Security Council sanctions on North Korea include restrictions on vessels flying flags of convenience linked to DPRK shipping networks. Enhanced flag state verification is now part of standard trade finance compliance.',
    detail: 'UN Security Council resolutions 2397 and 2371 require member states to inspect vessels suspected of involvement in DPRK sanctions evasion. The sanctions include de-flagging provisions — vessels found in violation must be de-registered by their flag state. For trade finance, this has elevated the importance of flag state due diligence. While this is primarily relevant to East Asian routes, the compliance overhead affects all trade finance documentation. For a Shanghai-to-Hamburg copper shipment, financiers should verify that the vessel (Pacific Dawn) is not flagged by a jurisdiction with weak sanctions enforcement and that its beneficial ownership does not trace to sanctioned entities.',
    severity: 'info',
    region: 'North Korea / East Asia',
    date: '2026-04-10',
    source: 'UN Security Council resolutions, IMO circulars (mock)',
    keywords: ['un sanction', 'north korea', 'flag state', 'beneficial ownership', 'dpk', 'compliance'],
    relevance: {
      routes: ['Shanghai->Hamburg', 'east asia'],
      commodities: ['all']
    }
  },

  {
    id: 'SAN-004',
    category: 'sanction_risk',
    title: 'China-EU trade tensions over dual-use goods classification affect copper cathode shipments',
    summary: 'Ongoing EU anti-subsidy investigations and dual-use goods controls create uncertainty for Chinese metal exports. While copper cathodes are generally not controlled, high-purity LME-grade copper can be classified as strategic material under certain EU import screening frameworks.',
    detail: 'The EU\'s Foreign Subsidies Regulation (FSR) and updated dual-use export control framework have introduced new screening requirements for imports from China. While copper cathode is not a traditional dual-use good, LME Grade A registered copper (minimum 99.99% purity) is classified as a strategic raw material under the EU Critical Raw Materials Act. For large shipments exceeding €5M in value, customs authorities in Hamburg may require additional end-use declarations and importer registration. This adds 1-3 days to customs clearance. For an $8.5M copper shipment, this screening is almost certain to apply. Trade financiers should verify that Hamburg Industrial GmbH has current EU importer registration and that the copper is destined for industrial manufacturing, not re-export to sanctioned entities.',
    severity: 'warning',
    region: 'China / EU',
    date: '2026-05-10',
    source: 'EU Foreign Subsidies Regulation, Critical Raw Materials Act (mock)',
    keywords: ['trade sanction', 'dual-use', 'export control', 'copper', 'critical raw materials', 'fsr', 'hamburg'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['copper', 'metals']
    }
  },

  // ============================================================
  // Category 3: port_congestion (4 entries)
  // ============================================================

  {
    id: 'POR-001',
    category: 'port_congestion',
    title: 'Shanghai port congestion extends berthing delays to 3-5 days amid export surge',
    summary: 'Shanghai Yangshan Deep-Water Port is experiencing severe congestion with vessel waiting times of 3-5 days due to a pre-tariff export surge and seasonal typhoon-related backlog. This directly impacts departure schedules for the Shanghai-to-Hamburg route.',
    detail: 'Shanghai port, the world\'s busiest container port handling over 47 million TEU annually, is experiencing significant congestion at its Yangshan terminal complex. A pre-tariff export surge combined with the backlog from two recent typhoon-related port closures has pushed anchorage waiting times from the normal 0.5 days to 3-5 days. For bulk and break-bulk vessels like the Pacific Dawn carrying copper cathodes, the wait is slightly shorter at 2-3 days, but schedule reliability for Shanghai departures has dropped to 42% (from a baseline of 65%). Vessel operators must now factor in an additional 3-day buffer at origin. For an eBL-backed financing with a 45-day duration, a 3-day departure delay represents a 6.7% increase in total voyage uncertainty.',
    severity: 'warning',
    region: 'Shanghai / East China',
    date: '2026-06-02',
    source: 'Shanghai International Shipping Institute, vessel AIS data (mock)',
    keywords: ['shanghai', 'port congestion', 'berthing delay', 'yangshan', 'export surge', 'schedule reliability', 'departure'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'POR-002',
    category: 'port_congestion',
    title: 'Singapore port transshipment congestion compounds schedule risk for Asia-Europe routes',
    summary: 'Singapore port, a critical bunkering and transshipment hub for Asia-Europe routes, reports anchorage waiting times of 2-3 days due to vessel diversions from the Red Sea crisis. This adds cumulative delay risk to Shanghai-Hamburg transits.',
    detail: 'Singapore\'s anchorage is operating at near capacity as vessels that have rerouted around the Cape of Good Hope use Singapore as their primary Asian bunkering and crew change hub. The Maritime and Port Authority of Singapore (MPA) reports anchorage utilization at 92%, with average waiting times for bunker-only calls extending to 36-48 hours. For a Shanghai-to-Hamburg vessel like the Pacific Dawn that may call at Singapore for bunkering before the Indian Ocean crossing, this adds 1.5-2 days. Combined with a potential 3-day departure delay at Shanghai, a vessel could be 5 days behind schedule before even entering the Indian Ocean, where monsoon conditions may add further delays.',
    severity: 'info',
    region: 'Singapore / Southeast Asia',
    date: '2026-05-25',
    source: 'MPA Singapore port statistics, Drewry container reports (mock)',
    keywords: ['singapore', 'transshipment', 'bunkering', 'congestion', 'anchorage', 'crew change', 'delay'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'POR-003',
    category: 'port_congestion',
    title: 'Hamburg port faces labor shortages and yard congestion threatening discharge timelines',
    summary: 'Port of Hamburg is experiencing labor shortages due to ongoing wage negotiations and elevated yard utilization from diverted Cape-routed vessels arriving in clusters. Discharge delays of 2-4 days are possible for vessels arriving without advance terminal booking.',
    detail: 'The Port of Hamburg, Europe\'s third-largest port and the primary destination for the Shanghai copper cathode shipment, is facing operational challenges. Ongoing wage negotiations between the ver.di union and the Central Association of German Seaport Operators (ZDS) have led to intermittent warning strikes, reducing terminal productivity by 30-40%. Simultaneously, vessels that rerouted via the Cape of Good Hope are arriving at Hamburg in clusters — 3-5 vessels within a 48-hour window — because the longer Cape route compresses arrival time variability. Yard utilization at HHLA Container Terminal Altenwerder is at 87%. For break-bulk copper cathode shipments handled at the Buss Hansa Terminal, discharge delays of 2-4 days are anticipated unless advance berthing windows are booked at least 14 days prior to ETA.',
    severity: 'warning',
    region: 'Hamburg / North Europe',
    date: '2026-06-01',
    source: 'Port of Hamburg Authority, ver.di union announcements (mock)',
    keywords: ['hamburg', 'labor shortage', 'yard congestion', 'strike', 'verdi', 'discharge delay', 'terminal', 'HHLA'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'POR-004',
    category: 'port_congestion',
    title: 'Suez Canal transit delays extend to 18-24 hours due to convoy scheduling changes',
    summary: 'Despite reduced traffic from Red Sea diversions, Suez Canal transit times have actually increased for remaining vessels due to new convoy scheduling protocols and enhanced security inspections, adding 18-24 hours to canal passage.',
    detail: 'The Suez Canal Authority (SCA) has implemented new security protocols for vessels transiting through the canal, including mandatory naval escort for the southbound convoy between Suez and Port Said. The daily southbound convoy now departs at 03:30 AM instead of the traditional 04:00 AM, with enhanced inspection stops at Ismailia. These changes, combined with reduced but more concentrated traffic patterns, have extended average transit time from the historical 12-14 hours to 18-24 hours. Additionally, the SCA has imposed a war risk surcharge of 5% on standard transit fees. For a Shanghai-to-Hamburg voyage, this means the Suez leg — once the fastest part of the journey — now adds nearly a full day to the schedule.',
    severity: 'info',
    region: 'Egypt / Suez Canal',
    date: '2026-05-30',
    source: 'Suez Canal Authority navigation circulars (mock)',
    keywords: ['suez canal', 'transit delay', 'convoy', 'security inspection', 'sca', 'naval escort', 'surcharge'],
    relevance: {
      routes: ['Shanghai->Hamburg', 'suez'],
      commodities: ['all']
    }
  },

  // ============================================================
  // Category 4: severe_weather (4 entries)
  // ============================================================

  {
    id: 'WEA-001',
    category: 'severe_weather',
    title: 'Indian Ocean southwest monsoon creates hazardous sea conditions June-September',
    summary: 'The annual southwest monsoon in the Indian Ocean (June-September) brings sustained wind speeds of 30-40 knots and significant wave heights of 4-6 meters between Sri Lanka and the Gulf of Aden. Vessel speed reductions of 2-4 knots and route deviations of 100-200nm are common, adding 1-3 days to Indian Ocean crossings.',
    detail: 'The southwest monsoon affects the entire Arabian Sea and western Indian Ocean basin from June through September. During peak monsoon (July-August), wave heights regularly exceed 5 meters, with storm cells producing 15-20 foot swells at 8-10 second intervals. The Pacific Dawn, a typical bulk carrier with a service speed of 14 knots, will likely reduce speed to 10-12 knots in these conditions for crew safety and cargo security. Additionally, the standard great-circle route from Sri Lanka toward the Gulf of Aden often requires a southerly deviation of 150-200nm to avoid the worst sea states. For copper cathode cargo, rough seas increase the risk of cargo shift and moisture damage if lashing is not inspected prior to the crossing. Historical data shows June-September transits have a 35% probability of weather-related delay exceeding 2 days.',
    severity: 'warning',
    region: 'Indian Ocean / Arabian Sea',
    date: '2026-06-01',
    source: 'Indian Meteorological Department, Joint Typhoon Warning Center, WMO (mock)',
    keywords: ['monsoon', 'indian ocean', 'heavy swell', 'wave height', 'speed reduction', 'route deviation', 'arabian sea', 'seasonal'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'WEA-002',
    category: 'severe_weather',
    title: 'Typhoon season in East China Sea and Western Pacific may force port closures and route deviations',
    summary: 'The Western Pacific typhoon season (May-November, peak July-October) averages 25 named storms annually. Departures from Shanghai are directly exposed: a typhoon approaching within 300nm of Shanghai triggers a mandatory 24-48 hour port closure, disrupting eBL-backed sailing schedules.',
    detail: 'The East China Sea is one of the most active tropical cyclone basins in the world. Shanghai\'s location at 31°N means it is directly in the path of recurving typhoons between July and October. The China Meteorological Administration (CMA) issues 72-hour typhoon warnings that trigger mandatory port preparedness protocols, including suspension of cargo operations and vessel movements. In 2025, Shanghai port experienced 4 typhoon-related closures totaling 9 days of lost operations. For an eBL-backed copper cathode shipment departing in early June, the probability of at least one typhoon warning during the voyage window is approximately 40%. The Pacific Dawn, if caught in a typhoon\'s outer bands, would need to either delay departure or take a 400nm easterly deviation around the storm system, adding 1.5-2 days.',
    severity: 'critical',
    region: 'East China Sea / Western Pacific',
    date: '2026-06-01',
    source: 'CMA typhoon forecasts, JTWC, WMO (mock)',
    keywords: ['typhoon', 'east china sea', 'port closure', 'shanghai', 'storm', 'deviation', 'cyclone', 'wmo'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'WEA-003',
    category: 'severe_weather',
    title: 'North Sea storm season (October-March) poses risks to final approach and Hamburg port entry',
    summary: 'North Sea winter storms generate significant wave heights of 6-10 meters in the German Bight, occasionally forcing Hamburg port to suspend pilotage services. For late-season transits, this adds arrival uncertainty.',
    detail: 'The North Sea is notorious for severe winter storms, with the German Bight (the southeastern North Sea approaching Hamburg via the Elbe River) being particularly exposed. Storm systems originating near Iceland track southeast, generating 8-12 second swells with significant wave heights exceeding 8 meters. When significant wave height exceeds 5 meters in the German Bight, the Elbe pilot station at Cuxhaven suspends boarding operations, effectively closing the port to inbound traffic. In the 2025-2026 winter season, pilotage was suspended on 12 separate occasions totaling 8 days. While the demo case has a June departure and July ETA (summer conditions), the 45-day financing window could extend into a period where early autumn storms affect the final leg. For copper cathode shipments, winter arrival also increases the risk of condensation damage during discharge if proper ventilation procedures are not followed.',
    severity: 'info',
    region: 'North Sea / German Bight / Elbe River',
    date: '2026-02-01',
    source: 'German Weather Service (DWD), Hamburg Port Authority (mock)',
    keywords: ['north sea', 'storm', 'german bight', 'elbe river', 'pilotage', 'wave height', 'hamburg approach'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['copper', 'metals']
    }
  },

  {
    id: 'WEA-004',
    category: 'severe_weather',
    title: 'English Channel and Bay of Biscay fog disrupts AIS tracking and vessel scheduling',
    summary: 'Seasonal fog in the English Channel and Bay of Biscay reduces visibility below 0.5nm, forcing speed reductions and creating AIS tracking gaps. This is a documentation concern for eBL-backed trade where continuous shipment visibility is expected.',
    detail: 'Dense advection fog affects the English Channel and Bay of Biscay primarily in spring and early summer (May-July), precisely when a June-departure Shanghai vessel would be transiting the final leg to Hamburg. Fog reduces visibility below 0.5 nautical miles, triggering mandatory speed reductions under COLREGS Rule 19 (conduct in restricted visibility). More critically for trade finance, fog often correlates with AIS signal degradation — vessels may appear to "disappear" from tracking for 4-6 hours. For eBL-backed financing that promotes "real-time shipment visibility," these gaps create documentation risk. The Pacific Dawn, approaching Hamburg via the English Channel in early-to-mid July, has a 25% probability of encountering at least one fog event requiring a 6-12 hour speed reduction, adding 0.3-0.5 days to the voyage.',
    severity: 'info',
    region: 'English Channel / Bay of Biscay',
    date: '2026-05-15',
    source: 'UK Met Office, Météo-France marine forecasts (mock)',
    keywords: ['fog', 'visibility', 'english channel', 'bay of biscay', 'ais', 'tracking gap', 'colregs', 'speed reduction'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  // ============================================================
  // Category 5: commodity_volatility (4 entries)
  // ============================================================

  {
    id: 'COM-001',
    category: 'commodity_volatility',
    title: 'LME copper price drops 12% amid global manufacturing slowdown and China demand concerns',
    summary: 'London Metal Exchange (LME) 3-month copper futures have declined from $8,500/MT to $7,480/MT (-12%) over the past 30 days, driven by weak PMI data from China and Europe. This directly reduces the verified collateral value of copper cathode shipments in transit.',
    detail: 'Copper prices have experienced a sharp correction driven by multiple headwinds: (1) China\'s official manufacturing PMI fell to 49.1 in May 2026, below the 50 expansion threshold for the third consecutive month; (2) Eurozone industrial production contracted 1.2% month-over-month; (3) LME warehouse inventories at Busan and Kaohsiung rose by 15,000 tonnes, signaling softening physical demand; (4) speculative long positions on the LME were unwound, with net long positions falling from 85,000 lots to 42,000 lots. For a 1,000 MT copper cathode shipment valued at $8.5M at departure, the mark-to-market value at current prices ($7,480/MT) is only $7.48M — a $1.02M decline. This is the most significant risk factor for the demo case, as it directly triggers the "commodity_price_drop" detection in the risk engine and reduces the verified collateral value (the minimum of declared, insured, and market value).',
    severity: 'critical',
    region: 'Global / LME',
    date: '2026-06-04',
    source: 'LME daily pricing, S&P Global PMI, CFTC commitment of traders (mock)',
    keywords: ['copper', 'lme', 'price drop', 'manufacturing', 'pmi', 'demand', 'inventory', 'futures', 'speculative'],
    relevance: {
      routes: ['all'],
      commodities: ['copper']
    }
  },

  {
    id: 'COM-002',
    category: 'commodity_volatility',
    title: 'LME copper warehouse inventory hits 6-month low, tightening physical market supply',
    summary: 'LME-registered copper warehouse inventories have fallen to a 6-month low of 85,000 tonnes (from 140,000 tonnes in January), tightening nearby spreads into backwardation. This creates price volatility risk for shipments priced against LME spot.',
    detail: 'Despite recent price weakness, LME on-warrant copper inventory has been steadily declining, falling to 85,000 tonnes — a 6-month low and representing only ~3 days of global consumption. The cash-to-3-month spread has flipped from a $30 contango in January to a $15 backwardation (cash premium over futures), indicating physical market tightness. Key contributing factors: (1) Codelco\'s Chuquicamata mine in Chile experienced a 12-day strike in April, reducing output by ~25,000 tonnes; (2) Chinese bonded warehouse stocks are being drawn down at 8,000 tonnes/week to feed domestic smelter demand; (3) India\'s growing copper demand (+8% YoY) is absorbing Asian spot cargoes. For the demo case\'s 1,000 MT copper shipment, the backwardation means the copper could actually sell at a premium to LME 3-month — but only if it arrives undamaged and on schedule. Any delay could mean missing a favorable pricing window.',
    severity: 'warning',
    region: 'Global / LME',
    date: '2026-06-03',
    source: 'LME warehouse reports, CRU copper market analysis (mock)',
    keywords: ['lme inventory', 'warehouse', 'backwardation', 'supply tight', 'copper cathode', 'physical market', 'spread'],
    relevance: {
      routes: ['all'],
      commodities: ['copper']
    }
  },

  {
    id: 'COM-003',
    category: 'commodity_volatility',
    title: 'Global energy transition drives structural copper demand growth, supporting medium-term prices',
    summary: 'Electrification and renewable energy deployment are driving structural copper demand growth of 3-4% annually, with demand projected to double by 2035. This creates a medium-term bullish outlook that partially offsets near-term cyclical weakness.',
    detail: 'The global energy transition is structurally bullish for copper: (1) electric vehicles use 83kg of copper per unit vs 23kg for ICE vehicles; (2) offshore wind farms require 8 tonnes of copper per MW; (3) grid modernization in the EU and US requires an estimated 10 million tonnes of additional copper through 2035. CRU Group forecasts a cumulative supply deficit of 4.7 million tonnes by 2030 as mine supply growth (1-2% CAGR) fails to keep pace with demand growth (3-4% CAGR). For trade financiers, this structural backdrop means copper cathode shipments have strong medium-term value — even if near-term prices are under pressure, the fundamental floor is higher than for most other commodities. An eBL-backed RWA tied to copper has better collateral quality than one tied to, say, thermal coal or iron ore. This is a positive factor that the AI pricing agent should include in its investor explanation to justify why a 0.80 issue price on a $1 target redemption is actually conservative given the structural demand outlook.',
    severity: 'info',
    region: 'Global',
    date: '2026-04-15',
    source: 'CRU Group, Bloomberg NEF, IEA critical minerals outlook (mock)',
    keywords: ['energy transition', 'electrification', 'ev', 'wind', 'grid', 'demand growth', 'supply deficit', 'structural'],
    relevance: {
      routes: ['all'],
      commodities: ['copper']
    }
  },

  {
    id: 'COM-004',
    category: 'commodity_volatility',
    title: 'Baltic Dry Index volatility signals freight rate uncertainty for bulk and break-bulk shipments',
    summary: 'The Baltic Dry Index (BDI) has fluctuated 35% over the past 90 days as Red Sea rerouting and seasonal demand patterns create freight rate volatility. For copper cathode break-bulk shipments, freight costs now represent 5-8% of cargo value, up from a historical 2-3%.',
    detail: 'The BDI, which tracks freight rates for dry bulk vessels (Capesize, Panamax, Supramax), has been highly volatile in 2026. The index swung from 1,200 to 1,850 and back to 1,450 between March and June as the market absorbed Red Sea diversions, Chinese import patterns, and seasonal grain shipping. For the Shanghai-to-Hamburg copper cathode shipment on the Pacific Dawn (a Supramax-class vessel), daily charter rates have moved from $12,000/day to $18,000/day. Over a 30-35 day voyage, this translates to a freight cost of $360,000-$630,000 — representing 4.2% to 7.4% of the $8.5M cargo value. Higher freight costs reduce the net recovery value of the cargo in a default scenario, which the AI pricing agent should factor into the liquidation recovery estimate.',
    severity: 'info',
    region: 'Global',
    date: '2026-06-02',
    source: 'Baltic Exchange daily indices, shipbroker reports (mock)',
    keywords: ['baltic dry', 'bdi', 'freight rate', 'shipping cost', 'supramax', 'charter rate', 'break-bulk'],
    relevance: {
      routes: ['all'],
      commodities: ['all']
    }
  },

  // ============================================================
  // Category 6: fx_volatility (4 entries)
  // ============================================================

  {
    id: 'FX-001',
    category: 'fx_volatility',
    title: 'USD/CNY exchange rate volatility impacts Chinese exporter cost base and financing economics',
    summary: 'The USD/CNY exchange rate has moved from 7.25 to 7.08 (-2.3%) over the past quarter, strengthening the RMB against the dollar. This reduces the RMB-equivalent proceeds for Chinese exporters receiving USDC-denominated financing.',
    detail: 'The Chinese yuan has strengthened against the US dollar, driven by (1) narrowing US-China interest rate differentials as the Fed signals rate cuts while the PBOC holds steady; (2) improving Chinese trade surplus data; (3) PBOC\'s daily fixing rate showing a bias toward a stronger yuan. For Shanghai Metals Export Co., a $5.6M USDC financing disbursement converted at 7.08 CNY/USD yields ¥39.65M, compared to ¥40.60M at the previous 7.25 rate — a ¥950,000 reduction in RMB terms. This may incentivize the exporter to request a faster payout speed (which means accepting a deeper discount) to lock in the current exchange rate before further yuan appreciation. The AI pricing agent should note that the exporter\'s urgency preference may be driven by FX considerations beyond pure financing cost.',
    severity: 'warning',
    region: 'China / United States',
    date: '2026-06-03',
    source: 'PBOC daily fixing rates, CFETS RMB index (mock)',
    keywords: ['usd cny', 'exchange rate', 'export cost', 'yuan', 'rmb', 'pboc', 'strengthening', 'convert'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'FX-002',
    category: 'fx_volatility',
    title: 'USD/EUR movements affect Hamburg importer payment capacity and USDC settlement value',
    summary: 'EUR/USD has moved from 1.08 to 1.12 (+3.7%) as the ECB maintains hawkish policy while the Fed signals cuts. For Hamburg Industrial GmbH, a stronger euro makes USDC-denominated trade settlement 3.7% cheaper than 3 months ago.',
    detail: 'The euro has appreciated against the dollar as the ECB maintains its deposit rate at 2.75% while markets price in 75bps of Fed cuts by December 2026. The EUR/USD pair trades at 1.12, up from 1.08 in March. For Hamburg Industrial GmbH, the German copper cathode importer, this is actually favorable: €5M now buys $5.6M in USDC (up from $5.4M). However, FX volatility works both ways — if the euro weakens before the 45-day financing window closes, the importer\'s payment in USDC becomes more expensive in EUR terms. The AI agent should consider whether to recommend FX hedging or whether the financing structure itself (USDC-denominated) adequately protects both parties. For the investor, the USDC denomination eliminates direct FX risk on the financing side, but the importer\'s FX exposure indirectly affects repayment probability.',
    severity: 'info',
    region: 'Europe / United States',
    date: '2026-06-04',
    source: 'ECB policy statements, Fed dot-plot, EUR/USD spot (mock)',
    keywords: ['usd eur', 'exchange rate', 'ecb', 'fed', 'euro', 'dollar', 'usdc', 'payment', 'hedging'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'FX-003',
    category: 'fx_volatility',
    title: 'Emerging market currency depreciation across trade finance counterparty chains',
    summary: 'Broad EM currency weakness (MSCI EM Currency Index -4.2% YTD) raises indirect counterparty risk for global trade finance. While the direct Shanghai-Hamburg pair uses major currencies, supply chain intermediaries may be exposed.',
    detail: 'The MSCI Emerging Markets Currency Index has declined 4.2% year-to-date as a strong dollar and capital outflows pressure EM currencies. While the direct Shanghai Metals Export Co. → Hamburg Industrial GmbH trade is denominated in USDC (eliminating direct EM FX risk), the copper supply chain involves intermediaries in multiple jurisdictions. Shanghai Metals may source copper concentrate from mines in Chile (CLP), Peru (PEN), or the DRC (CDF), all of whose currencies have weakened 5-10% against the dollar. While this reduces input costs for the Chinese smelter, it may also create quality or delivery risk if mining operations face capital constraints from local currency weakness. The AI agent should flag this as a secondary risk factor — not directly impacting the financing, but potentially affecting the underlying copper quality and origin verification.',
    severity: 'info',
    region: 'Emerging Markets / Global',
    date: '2026-05-20',
    source: 'MSCI currency indices, IMF World Economic Outlook (mock)',
    keywords: ['em currency', 'depreciation', 'counterparty risk', 'supply chain', 'dollar strength', 'copper mining'],
    relevance: {
      routes: ['all'],
      commodities: ['copper', 'metals']
    }
  },

  {
    id: 'FX-004',
    category: 'fx_volatility',
    title: 'Stablecoin (USDC) regulatory developments affect RWA settlement certainty',
    summary: 'EU MiCA stablecoin regulations for USDC took full effect in 2025, and US stablecoin legislation is advancing. The regulatory clarity supports USDC as a settlement currency, but pending US legislation could introduce transitional compliance requirements.',
    detail: 'The EU\'s Markets in Crypto-Assets (MiCA) regulation has been fully applicable to stablecoins since mid-2025, with Circle\'s USDC receiving EU approval as a regulated e-money token. This provides strong legal certainty for using USDC as the settlement currency in eBL-backed RWA trade finance. In the US, the Clarity for Payment Stablecoins Act has passed the House Financial Services Committee and awaits a floor vote. While this is generally positive, the transition from current state-level regulation (Circle is regulated under NYDFS BitLicense) to a federal framework could introduce temporary compliance friction. For the demo, the key point is: USDC settlement is legally recognized in both the EU and (likely soon) US jurisdictions, giving investors confidence that their USDC-denominated returns are enforceable.',
    severity: 'info',
    region: 'EU / United States',
    date: '2026-04-01',
    source: 'EU MiCA regulation, US Congress stablecoin legislation tracker (mock)',
    keywords: ['usdc', 'stablecoin', 'mica', 'regulation', 'circle', 'settlement', 'certainty', 'compliance'],
    relevance: {
      routes: ['all'],
      commodities: ['all']
    }
  },

  // ============================================================
  // Category 7: buyer_country_risk (4 entries)
  // ============================================================

  {
    id: 'BUY-001',
    category: 'buyer_country_risk',
    title: 'German corporate insolvencies rise 15% YoY, elevating importer credit risk assessment',
    summary: 'German corporate insolvency filings increased 15% year-over-year in Q1 2026, driven by elevated energy costs, weak industrial demand, and the end of government COVID-era support measures. Trade financiers should perform enhanced credit assessment on German importers of industrial commodities.',
    detail: 'Germany\'s Federal Statistical Office (Destatis) reported 4,210 corporate insolvencies in Q1 2026, a 15% increase from Q1 2025 and the highest quarterly figure since 2017. The manufacturing sector accounts for 28% of filings, with metals processing and automotive suppliers particularly affected. Key drivers: (1) industrial electricity prices remain 40% above pre-2022 levels; (2) German industrial production has contracted for 6 of the past 8 quarters; (3) the ZEW economic sentiment index dropped to -18.5 in May. For Hamburg Industrial GmbH, the copper cathode importer, credit risk depends on its end-customer base — if it supplies the automotive or construction sectors, it faces elevated receivables risk. The AI agent should flag this as a buyer_country_risk factor and potentially recommend a higher risk discount on the RWA issue price to compensate for elevated importer default probability.',
    severity: 'warning',
    region: 'Germany / EU',
    date: '2026-05-15',
    source: 'Destatis insolvency statistics, ZEW economic sentiment, Bundesbank (mock)',
    keywords: ['germany', 'insolvency', 'corporate default', 'manufacturing', 'energy costs', 'destatis', 'zurich'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['copper', 'metals']
    }
  },

  {
    id: 'BUY-002',
    category: 'buyer_country_risk',
    title: 'EU import regulation changes may delay customs clearance for Chinese-origin industrial goods',
    summary: 'New EU customs regulations require additional documentation for Chinese-origin industrial goods above €2.5M, including a Carbon Border Adjustment Mechanism (CBAM) declaration. For the $8.5M copper cathode shipment, this adds 1-3 days to Hamburg customs clearance.',
    detail: 'The EU\'s Carbon Border Adjustment Mechanism (CBAM) transitional phase now covers copper products (CN code 7403), requiring importers to report embedded carbon emissions for shipments above €2.5M in value. For Shanghai Metals Export Co.\'s 1,000 MT copper cathode shipment valued at $8.5M (~€7.8M), Hamburg Industrial GmbH must submit a CBAM declaration within 30 days of import, reporting the carbon intensity of the Chinese copper smelting process. Failure to submit the declaration results in a penalty of €10-50 per tonne of CO2 equivalent. Separately, the EU\'s Import Control System 2 (ICS2) now requires Entry Summary Declarations 24 hours before vessel arrival. Combined with existing customs documentation, the clearance process for this shipment is estimated at 3-5 business days from vessel arrival to cargo release — compared to 2-3 days a year ago. This delay should be factored into the ETA-to-payment timeline in the financing structure.',
    severity: 'info',
    region: 'EU / Germany / Hamburg',
    date: '2026-05-01',
    source: 'EU CBAM regulation, ICS2 implementation guidelines (mock)',
    keywords: ['eu regulation', 'cbam', 'customs', 'carbon', 'import declaration', 'ics2', 'clearance delay', 'copper'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['copper', 'metals']
    }
  },

  {
    id: 'BUY-003',
    category: 'buyer_country_risk',
    title: 'Cross-border payment settlement delays average 3-5 business days for China-to-EU trade',
    summary: 'SWIFT payment routing between Chinese and German banks averages 3-5 business days for amounts above $1M due to correspondent banking chain complexity and time zone differences. USDC settlement on-chain could reduce this to minutes, but fiat on/off-ramp delays persist.',
    detail: 'Traditional SWIFT-based cross-border payments between China and Germany typically involve 2-4 correspondent banks, adding 3-5 business days to settlement from payment initiation to cleared funds. Time zone differences (CST is 6 hours ahead of CET) mean that a payment initiated Monday morning in Hamburg may not be credited to Shanghai Metals Export Co.\'s account until Thursday or Friday. This is precisely the pain point that USDC-based settlement aims to solve: on-chain USDC transfers settle in ~15 minutes regardless of amount or geography. However, the fiat on/off-ramp for the importer (converting EUR to USDC) and for the exporter (converting USDC to CNY) still involves 1-2 business days at each end through regulated exchanges. Net settlement time with USDC is estimated at 2-4 business days (vs 3-5 for SWIFT), representing a meaningful but not revolutionary improvement. For the AI pricing agent, the 1-2 day reduction in settlement time justifies a small reduction in the time-value discount applied to the issue price.',
    severity: 'info',
    region: 'China / EU',
    date: '2026-04-20',
    source: 'SWIFT gpi data, Circle USDC settlement analytics (mock)',
    keywords: ['cross-border payment', 'swift', 'settlement delay', 'usdc', 'correspondent banking', 'time zone', 'on-ramp'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['all']
    }
  },

  {
    id: 'BUY-004',
    category: 'buyer_country_risk',
    title: 'German industrial metals demand outlook: weak near-term but structural copper demand from energy transition',
    summary: 'German industrial metals demand is weak in the near term (manufacturing PMI 43.2) but the long-term outlook for copper is strong due to electrification, grid expansion, and renewable energy buildout under the Energiewende policy framework.',
    detail: 'Germany\'s manufacturing PMI has been below 50 (contraction) for 22 consecutive months, reflecting weak industrial demand across the metals supply chain. However, Germany\'s Energiewende (energy transition) policy targets 80% renewable electricity by 2030, requiring an estimated €45 billion in grid infrastructure investment. Each kilometer of high-voltage underground cable uses approximately 28 tonnes of copper. Major projects include SuedLink (700km, ~19,600 tonnes of copper) and SuedOstLink (540km, ~15,100 tonnes). Hamburg Industrial GmbH, as a copper cathode importer supplying German cable manufacturers, benefits from this structural demand driver. The AI pricing agent should differentiate between cyclical weakness (affecting short-term copper prices and importer credit risk) and structural demand (supporting collateral value over the medium term). This balanced assessment should flow into the risk discount: elevated near-term risk justifies a moderate discount, but the structural demand floor prevents a deep liquidation-level discount.',
    severity: 'info',
    region: 'Germany / EU',
    date: '2026-05-10',
    source: 'S&P Global Germany Manufacturing PMI, BMWK Energiewende reports (mock)',
    keywords: ['germany', 'manufacturing', 'pmi', 'energiewende', 'grid', 'electrification', 'demand outlook', 'structural'],
    relevance: {
      routes: ['Shanghai->Hamburg'],
      commodities: ['copper']
    }
  }
];

// ---- Helper functions ----

export function getCategoryCounts() {
  const counts = {};
  for (const cat of KNOWLEDGE_CATEGORIES) {
    counts[cat] = 0;
  }
  for (const entry of KNOWLEDGE_BASE) {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
  }
  return counts;
}

export function getAllEntries() {
  return KNOWLEDGE_BASE;
}

export function getEntriesByCategory(category) {
  return KNOWLEDGE_BASE.filter(e => e.category === category);
}

export function validateKnowledgeBase() {
  const errors = [];
  const ids = new Set();

  for (const entry of KNOWLEDGE_BASE) {
    // Check for duplicate IDs
    if (ids.has(entry.id)) {
      errors.push(`Duplicate ID: ${entry.id}`);
    }
    ids.add(entry.id);

    // Check required fields
    const required = ['id', 'category', 'title', 'summary', 'detail', 'severity', 'region', 'date', 'source', 'keywords', 'relevance'];
    for (const field of required) {
      if (entry[field] === undefined || entry[field] === null) {
        errors.push(`${entry.id}: missing required field "${field}"`);
      }
    }

    // Check category validity
    if (entry.category && !KNOWLEDGE_CATEGORIES.includes(entry.category)) {
      errors.push(`${entry.id}: invalid category "${entry.category}"`);
    }

    // Check severity validity
    if (entry.severity && !['info', 'warning', 'critical'].includes(entry.severity)) {
      errors.push(`${entry.id}: invalid severity "${entry.severity}"`);
    }

    // Check keywords is non-empty array
    if (entry.keywords && (!Array.isArray(entry.keywords) || entry.keywords.length === 0)) {
      errors.push(`${entry.id}: keywords must be a non-empty array`);
    }

    // Check date string is ISO-compatible
    if (entry.date && typeof entry.date === 'string' && Number.isNaN(Date.parse(entry.date))) {
      errors.push(`${entry.id}: date must be ISO-compatible`);
    }
  }

  // Check minimum entries per category
  const counts = getCategoryCounts();
  for (const cat of KNOWLEDGE_CATEGORIES) {
    if ((counts[cat] || 0) < 3) {
      errors.push(`Category "${cat}" has fewer than 3 entries (${counts[cat] || 0})`);
    }
  }

  return errors;
}
