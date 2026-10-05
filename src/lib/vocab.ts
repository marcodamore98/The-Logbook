// Standardized vocabularies. Work and gym entries only use ids from these
// lists, so weekly/monthly/yearly statistics group reliably. Labels can be
// reworded freely; ids must never change once data exists.

import { ROSTER_COLLEAGUES, ROSTER_SHIFT_TYPES } from './roster';
import type { Settings, ShiftType } from './types';

export interface VocabItem {
  id: string;
  label: string;
  group?: string;
  /** Extra words the search also matches (abbreviations, eponyms). */
  kw?: string;
  /** Old entry kept only so saved data still has a name: not offered any more. */
  legacy?: boolean;
  /** Usual access route for a procedure (vocab.APPROACHES). */
  approach?: string;
  /** A combination: picking it adds each of these procedures separately. */
  parts?: string[];
}

// ---------- Ginecologia, Ostetricia, Uroginecologia, Senologia ----------
// Oncologic procedures follow the ESGO guidelines (cervix 2023, endometrium 2025,
// ovary ESGO–ESMO 2023, vulva 2023). Pelvic floor surgery is split into its
// demolitive and reconstructive steps, so each step can have its own role.

const G = {
  ob: 'Ostetricia',
  hys: 'Ginecologia – isteroscopia',
  lps: 'Ginecologia – laparoscopia/laparotomia',
  steps: 'Tempi chirurgici',
  vag: 'Ginecologia – vaginale e minori',
  cx: 'Oncologia – cervice',
  endo: 'Oncologia – endometrio',
  ov: 'Oncologia – ovaio',
  vulva: 'Oncologia – vulva e vagina',
  ln: 'Oncologia – linfonodi e stadiazione',
  popD: 'Statica pelvica – tempo demolitivo',
  popR: 'Statica pelvica – tempo ricostruttivo',
  uro: 'Uroginecologia – incontinenza e altro',
  breast: 'Senologia – mammella',
  axilla: 'Senologia – ascella',
  recon: 'Senologia – ricostruzione',
} as const;

export const PROCEDURE_GROUPS = Object.values(G);

/** Usual access route per group, when a procedure doesn't say otherwise. */
export const GROUP_APPROACH: Record<string, string> = {
  [G.ob]: 'vaginal',
  [G.hys]: 'hysteroscopic',
  [G.vag]: 'vaginal',
  [G.vulva]: 'open',
  [G.popD]: 'vaginal',
  [G.popR]: 'vaginal',
  [G.uro]: 'vaginal',
  [G.breast]: 'open',
  [G.axilla]: 'open',
  [G.recon]: 'open',
};

export const PROCEDURES: VocabItem[] = [
  // Ostetricia
  { id: 'ob-parto-spontaneo', label: 'Assistenza al parto spontaneo', group: G.ob },
  { id: 'ob-parto-operativo-ventosa', label: 'Parto operativo con ventosa', group: G.ob, kw: 'vacuum' },
  { id: 'ob-parto-operativo-forcipe', label: 'Parto operativo con forcipe', group: G.ob },
  { id: 'ob-distocia-spalle', label: 'Manovre per distocia di spalla', group: G.ob, kw: 'McRoberts Rubin Woods' },
  { id: 'ob-parto-podalico', label: 'Assistenza al parto podalico vaginale', group: G.ob },
  { id: 'ob-parto-gemellare', label: 'Assistenza al parto gemellare', group: G.ob },
  { id: 'ob-tc-elettivo', label: 'Taglio cesareo elettivo', group: G.ob, approach: 'open', kw: 'TC' },
  { id: 'ob-tc-urgente', label: 'Taglio cesareo urgente/emergente', group: G.ob, approach: 'open', kw: 'TC' },
  { id: 'ob-tc-iterativo', label: 'Taglio cesareo iterativo', group: G.ob, approach: 'open', kw: 'TC' },
  { id: 'ob-tc-pas', label: 'Taglio cesareo per placenta accreta (PAS)', group: G.ob, approach: 'open', kw: 'TC percreta increta' },
  { id: 'ob-episiorrafia', label: 'Episiotomia/episiorrafia', group: G.ob },
  { id: 'ob-lacerazione-1-2', label: 'Sutura lacerazione perineale I–II grado', group: G.ob },
  { id: 'ob-lacerazione-3-4', label: 'Riparazione lacerazione perineale III–IV grado', group: G.ob, kw: 'OASIS sfintere' },
  { id: 'ob-lacerazione-cervicale', label: 'Sutura lacerazione cervicale / vaginale alta', group: G.ob },
  { id: 'ob-ematoma-perineale', label: 'Drenaggio ematoma vulvo-vaginale/perineale', group: G.ob },
  { id: 'ob-secondamento-manuale', label: 'Secondamento manuale', group: G.ob },
  { id: 'ob-revisione-cavita', label: 'Revisione della cavità uterina', group: G.ob },
  { id: 'ob-balloon-bakri', label: 'Balloon intrauterino (Bakri) per EPP', group: G.ob, kw: 'emorragia post partum' },
  { id: 'ob-b-lynch', label: 'Sutura compressiva (B-Lynch)', group: G.ob, approach: 'open', kw: 'EPP emorragia' },
  { id: 'ob-legatura-uterine', label: 'Legatura delle arterie uterine (O’Leary)', group: G.ob, approach: 'open', kw: 'EPP emorragia' },
  { id: 'ob-legatura-ipogastriche', label: 'Legatura delle arterie ipogastriche', group: G.ob, approach: 'open', kw: 'iliache interne EPP' },
  { id: 'ob-isterectomia-peripartum', label: 'Isterectomia peripartum', group: G.ob, approach: 'open', kw: 'EPP emorragia' },
  { id: 'ob-inversione-uterina', label: 'Riposizionamento di inversione uterina', group: G.ob },
  { id: 'ob-cerchiaggio', label: 'Cerchiaggio cervicale', group: G.ob, kw: 'McDonald Shirodkar' },
  { id: 'ob-cerchiaggio-addominale', label: 'Cerchiaggio addominale', group: G.ob, approach: 'laparoscopic' },
  { id: 'ob-versione-esterna', label: 'Rivolgimento per manovre esterne', group: G.ob, approach: 'na', kw: 'versione cefalica' },
  { id: 'ob-amniocentesi', label: 'Amniocentesi', group: G.ob, approach: 'percutaneous' },
  { id: 'ob-villocentesi', label: 'Villocentesi (CVS)', group: G.ob, approach: 'percutaneous' },
  { id: 'ob-cordocentesi', label: 'Cordocentesi', group: G.ob, approach: 'percutaneous' },
  { id: 'ob-ivg-chirurgica', label: 'IVG / RCU (isterosuzione)', group: G.ob, kw: 'aborto' },
  { id: 'ob-extrauterina-lps', label: 'Gravidanza extrauterina – laparoscopia', group: G.ob, approach: 'laparoscopic', kw: 'ectopica GEU' },

  // Isteroscopia
  { id: 'hys-diagnostica', label: 'Isteroscopia diagnostica', group: G.hys },
  { id: 'hys-biopsia', label: 'Biopsia endometriale mirata', group: G.hys },
  { id: 'hys-polipectomia', label: 'Polipectomia isteroscopica', group: G.hys },
  { id: 'hys-miomectomia', label: 'Miomectomia isteroscopica', group: G.hys },
  { id: 'hys-metroplastica', label: 'Metroplastica isteroscopica (setto)', group: G.hys },
  { id: 'hys-adesiolisi', label: 'Adesiolisi isteroscopica', group: G.hys, kw: 'Asherman sinechie' },
  { id: 'hys-ablazione', label: 'Ablazione/resezione endometriale', group: G.hys },
  { id: 'hys-istmocele', label: 'Correzione di istmocele (niche)', group: G.hys },
  { id: 'hys-residui', label: 'Rimozione di residui (RPOC)', group: G.hys },
  { id: 'hys-rimozione-iud', label: 'Rimozione IUD/corpo estraneo', group: G.hys },

  // Laparoscopia / laparotomia (benigna)
  { id: 'lps-diagnostica', label: 'Laparoscopia diagnostica', group: G.lps },
  { id: 'lps-adesiolisi', label: 'Adesiolisi', group: G.lps },
  { id: 'lps-cistectomia-ovarica', label: 'Cistectomia ovarica', group: G.lps },
  { id: 'lps-annessiectomia', label: 'Annessiectomia (mono/bilaterale)', group: G.lps, legacy: true },
  { id: 'lps-annessiectomia-mono', label: 'Annessiectomia monolaterale', group: G.lps, kw: 'USO salpingo-ovariectomia' },
  { id: 'lps-annessiectomia-bi', label: 'Annessiectomia bilaterale', group: G.lps, kw: 'BSO salpingo-ovariectomia' },
  { id: 'lps-ovariectomia', label: 'Ovariectomia', group: G.lps },
  { id: 'lps-salpingectomia', label: 'Salpingectomia', group: G.lps, legacy: true },
  { id: 'lps-salpingectomia-mono', label: 'Salpingectomia monolaterale', group: G.lps },
  { id: 'lps-salpingectomia-bi', label: 'Salpingectomia bilaterale (anche opportunistica)', group: G.lps },
  { id: 'lps-salpingotomia', label: 'Salpingotomia (gravidanza ectopica)', group: G.lps, kw: 'GEU' },
  { id: 'lps-detorsione', label: 'Detorsione annessiale', group: G.lps },
  { id: 'lps-drilling', label: 'Drilling ovarico', group: G.lps, kw: 'PCOS' },
  { id: 'lps-endometriosi', label: 'Exeresi endometriosi (superficiale/profonda)', group: G.lps, legacy: true },
  { id: 'lps-endometriosi-superficiale', label: 'Endometriosi peritoneale superficiale', group: G.lps },
  { id: 'lps-endometrioma', label: 'Exeresi di endometrioma', group: G.lps },
  { id: 'lps-endometriosi-profonda', label: 'Endometriosi profonda (shaving/nodulectomia)', group: G.lps, kw: 'DIE' },
  { id: 'lps-resezione-intestinale-endo', label: 'Resezione intestinale per endometriosi (discoide/segmentaria)', group: G.lps, kw: 'DIE' },
  { id: 'lps-ureterolisi', label: 'Ureterolisi', group: G.lps },
  { id: 'lps-cistectomia-parziale', label: 'Resezione vescicale parziale', group: G.lps },
  { id: 'lps-miomectomia', label: 'Miomectomia', group: G.lps },
  { id: 'lps-isterectomia-totale', label: 'Isterectomia totale (semplice)', group: G.lps, kw: 'TLH LH' },
  { id: 'lps-isterectomia-subtotale', label: 'Isterectomia subtotale (sopracervicale)', group: G.lps, kw: 'LSH' },
  { id: 'lps-cromosalpingoscopia', label: 'Cromosalpingoscopia', group: G.lps },
  { id: 'lps-sterilizzazione', label: 'Sterilizzazione tubarica', group: G.lps },

  // Tempi chirurgici: parts of an intervention that can be done (and logged) on their own
  { id: 'step-accessi-lps', label: 'Accessi laparoscopici (pneumoperitoneo e trocar)', group: G.steps, approach: 'laparoscopic', kw: 'trocar Veress Hasson open laparoscopy ombelicale' },
  { id: 'step-docking-robotico', label: 'Docking robotico', group: G.steps, approach: 'robotic', kw: 'robot da Vinci undocking' },
  { id: 'step-sutura-cupola', label: 'Sutura della cupola vaginale', group: G.steps, approach: 'laparoscopic', kw: 'chiusura cupola vaginale isterectomia' },

  // Vaginale e minori
  { id: 'vag-isterectomia', label: 'Isterectomia vaginale', group: G.vag, kw: 'VH' },
  { id: 'vag-conizzazione-leep', label: 'Conizzazione / LEEP', group: G.vag, kw: 'LLETZ' },
  { id: 'vag-biopsia-cervice', label: 'Biopsia cervicale/vulvare', group: G.vag },
  { id: 'vag-bartolini', label: 'Marsupializzazione/exeresi ghiandola di Bartolini', group: G.vag },
  { id: 'vag-rcu', label: 'Revisione cavità (RCU) / dilatazione e curettage', group: G.vag },
  { id: 'vag-polipectomia-cervicale', label: 'Polipectomia cervicale', group: G.vag },
  { id: 'vag-condilomi', label: 'Asportazione/diatermocoagulazione di condilomi', group: G.vag },
  { id: 'vag-cisti-vaginale', label: 'Exeresi di cisti vaginale', group: G.vag, kw: 'Gartner' },
  { id: 'vag-labioplastica', label: 'Ninfoplastica / labioplastica', group: G.vag },
  { id: 'vag-ascesso', label: 'Drenaggio di ascesso (vulvare/pelvico)', group: G.vag },
  { id: 'vag-eua', label: 'Esame in narcosi', group: G.vag, kw: 'EUA' },
  { id: 'vag-iud-inserimento', label: 'Inserimento IUD / impianto sottocutaneo', group: G.vag },

  // Oncologia – cervice (ESGO 2023)
  { id: 'onc-isterectomia-semplice', label: 'Isterectomia semplice extrafasciale (tipo A)', group: G.cx, kw: 'Querleu Morrow SHAPE' },
  { id: 'onc-isterectomia-radicale', label: 'Isterectomia radicale', group: G.cx, kw: 'Piver Wertheim Meigs' },
  { id: 'onc-isterectomia-radicale-b', label: 'Isterectomia radicale tipo B (Querleu-Morrow)', group: G.cx, kw: 'Piver II modificata' },
  { id: 'onc-isterectomia-radicale-c1', label: 'Isterectomia radicale tipo C1 (nerve-sparing)', group: G.cx, kw: 'Querleu Morrow Piver III' },
  { id: 'onc-isterectomia-radicale-c2', label: 'Isterectomia radicale tipo C2', group: G.cx, kw: 'Querleu Morrow Piver III' },
  { id: 'onc-trachelectomia', label: 'Trachelectomia', group: G.cx, legacy: true },
  { id: 'onc-trachelectomia-semplice', label: 'Trachelectomia semplice', group: G.cx, kw: 'fertility sparing' },
  { id: 'onc-trachelectomia-radicale', label: 'Trachelectomia radicale', group: G.cx, kw: 'fertility sparing Dargent' },
  { id: 'onc-parametrectomia', label: 'Parametrectomia radicale (dopo isterectomia semplice)', group: G.cx },
  { id: 'onc-trasposizione-ovarica', label: 'Trasposizione ovarica', group: G.cx },
  { id: 'onc-exenteratio-anteriore', label: 'Eviscerazione pelvica anteriore', group: G.cx, approach: 'open', kw: 'exenteratio' },
  { id: 'onc-exenteratio-posteriore', label: 'Eviscerazione pelvica posteriore', group: G.cx, approach: 'open', kw: 'exenteratio' },
  { id: 'onc-exenteratio-totale', label: 'Eviscerazione pelvica totale', group: G.cx, approach: 'open', kw: 'exenteratio' },

  // Oncologia – endometrio (ESGO/ESTRO/ESP)
  { id: 'onc-isterectomia-totale-ext', label: 'Isterectomia totale extrafasciale (carcinoma endometrio)', group: G.endo, kw: 'TLH stadiazione' },
  { id: 'onc-isteroscopia-fertility', label: 'Resezione isteroscopica fertility sparing', group: G.endo, approach: 'hysteroscopic' },

  // Oncologia – ovaio (ESGO–ESMO)
  { id: 'onc-laparoscopia-stadiativa', label: 'Laparoscopia stadiativa (score di Fagotti)', group: G.ov, approach: 'laparoscopic', kw: 'PIV operabilità' },
  { id: 'onc-stadiazione-ovaio', label: 'Stadiazione chirurgica carcinoma ovarico', group: G.ov },
  { id: 'onc-citoriduzione', label: 'Chirurgia citoriduttiva', group: G.ov, legacy: true },
  { id: 'onc-citoriduzione-primaria', label: 'Citoriduzione primaria (PDS)', group: G.ov, approach: 'open', kw: 'debulking' },
  { id: 'onc-citoriduzione-intervallo', label: 'Citoriduzione d’intervallo (IDS)', group: G.ov, approach: 'open', kw: 'debulking' },
  { id: 'onc-citoriduzione-secondaria', label: 'Citoriduzione secondaria (recidiva)', group: G.ov, approach: 'open', kw: 'debulking' },
  { id: 'onc-rrso', label: 'Annessiectomia bilaterale di riduzione del rischio (RRSO)', group: G.ov, approach: 'laparoscopic', kw: 'BRCA profilattica' },
  { id: 'onc-appendicectomia', label: 'Appendicectomia', group: G.ov },
  { id: 'onc-peritonectomia-pelvica', label: 'Peritonectomia pelvica', group: G.ov },
  { id: 'onc-peritonectomia-diaframmatica', label: 'Peritonectomia / resezione diaframmatica', group: G.ov, kw: 'stripping' },
  { id: 'onc-resezione-rettosigma', label: 'Resezione anteriore del retto-sigma', group: G.ov },
  { id: 'onc-resezione-intestinale', label: 'Altra resezione intestinale (tenue/colon)', group: G.ov },
  { id: 'onc-stomia', label: 'Confezionamento di stomia (ileo/colostomia)', group: G.ov },
  { id: 'onc-splenectomia', label: 'Splenectomia', group: G.ov },
  { id: 'onc-linfonodi-bulky', label: 'Asportazione di linfonodi bulky / cardiofrenici', group: G.ov },
  { id: 'onc-hipec', label: 'HIPEC', group: G.ov, kw: 'chemioipertermia' },

  // Oncologia – vulva e vagina (ESGO 2023)
  { id: 'onc-escissione-vulva', label: 'Escissione locale radicale / vulvectomia parziale', group: G.vulva },
  { id: 'onc-vulvectomia', label: 'Vulvectomia (semplice/radicale)', group: G.vulva, legacy: true },
  { id: 'onc-vulvectomia-semplice', label: 'Vulvectomia semplice / skinning', group: G.vulva },
  { id: 'onc-vulvectomia-radicale', label: 'Vulvectomia radicale totale', group: G.vulva },
  { id: 'onc-ls-inguinale-mono', label: 'Linfonodo sentinella inguino-femorale monolaterale', group: G.vulva, kw: 'LS SLN' },
  { id: 'onc-ls-inguinale-bi', label: 'Linfonodo sentinella inguino-femorale bilaterale', group: G.vulva, kw: 'LS SLN' },
  { id: 'onc-linfadenectomia-inguinale-mono', label: 'Linfadenectomia inguino-femorale monolaterale', group: G.vulva },
  { id: 'onc-linfadenectomia-inguinale-bi', label: 'Linfadenectomia inguino-femorale bilaterale', group: G.vulva },
  { id: 'onc-lembo-vulvare', label: 'Ricostruzione vulvare con lembo', group: G.vulva, kw: 'V-Y romboide' },
  { id: 'onc-laser-vin', label: 'Laser CO2 / escissione per VIN–VaIN', group: G.vulva },
  { id: 'onc-colpectomia', label: 'Colpectomia per neoplasia vaginale', group: G.vulva },

  // Oncologia – linfonodi e stadiazione (cervice, endometrio, ovaio)
  { id: 'onc-linfonodo-sentinella', label: 'Linfonodo sentinella', group: G.ln, legacy: true },
  { id: 'onc-ls-pelvico-bi', label: 'Biopsia del linfonodo sentinella pelvico bilaterale', group: G.ln, kw: 'LS SLN ICG' },
  { id: 'onc-ls-pelvico-mono', label: 'Biopsia del linfonodo sentinella pelvico monolaterale', group: G.ln, kw: 'LS SLN ICG' },
  { id: 'onc-linfadenectomia-side-specific', label: 'Linfadenectomia pelvica side-specific (mancato mapping)', group: G.ln },
  { id: 'onc-linfadenectomia-pelvica', label: 'Linfadenectomia pelvica (sistematica)', group: G.ln, kw: 'LND' },
  { id: 'onc-linfadenectomia-aortica', label: 'Linfadenectomia lombo-aortica (para-aortica)', group: G.ln, kw: 'LND' },
  { id: 'onc-washing', label: 'Washing peritoneale (citologia)', group: G.ln },
  { id: 'onc-biopsie-peritoneali', label: 'Biopsie peritoneali multiple', group: G.ln },
  { id: 'onc-omentectomia', label: 'Omentectomia', group: G.ln, legacy: true },
  { id: 'onc-omentectomia-infracolica', label: 'Omentectomia infracolica', group: G.ln },
  { id: 'onc-omentectomia-infragastrica', label: 'Omentectomia infragastrica (totale)', group: G.ln },

  // Statica pelvica – tempo demolitivo
  { id: 'pop-isterectomia-vaginale', label: 'Isterectomia vaginale (per prolasso)', group: G.popD, approach: 'vaginal', kw: 'VH POP' },
  { id: 'pop-isterectomia-subtotale', label: 'Isterectomia subtotale (per prolasso)', group: G.popD, approach: 'laparoscopic', kw: 'LSH POP cervicosacropessi' },
  { id: 'pop-isterectomia-totale', label: 'Isterectomia totale (per prolasso)', group: G.popD, approach: 'laparoscopic', kw: 'TLH POP' },
  { id: 'pop-amputazione-cervice', label: 'Amputazione della cervice (Manchester)', group: G.popD, kw: 'Fothergill' },
  { id: 'pop-trachelectomia-moncone', label: 'Trachelectomia del moncone cervicale', group: G.popD },
  { id: 'pop-colpectomia', label: 'Colpectomia (prima di colpocleisi)', group: G.popD },
  { id: 'uro-rimozione-mesh', label: 'Rimozione/revisione di mesh o sling', group: G.popD },

  // Statica pelvica – tempo ricostruttivo
  { id: 'uro-colporrafia-anteriore', label: 'Colporrafia anteriore (plastica fasciale)', group: G.popR, kw: 'cistocele' },
  { id: 'pop-mesh-anteriore', label: 'Riparazione anteriore con mesh transvaginale', group: G.popR, kw: 'cistocele' },
  { id: 'pop-paravaginale', label: 'Riparazione del difetto paravaginale', group: G.popR, kw: 'cistocele' },
  { id: 'uro-colporrafia-posteriore', label: 'Colporrafia posteriore / perineoplastica', group: G.popR, legacy: true },
  { id: 'pop-colporrafia-posteriore', label: 'Colporrafia posteriore (plastica fasciale)', group: G.popR, kw: 'rettocele' },
  { id: 'pop-rettocele-sito-specifica', label: 'Riparazione sito-specifica del rettocele', group: G.popR },
  { id: 'pop-mesh-posteriore', label: 'Riparazione posteriore con mesh', group: G.popR, kw: 'rettocele' },
  { id: 'pop-enterocele', label: 'Riparazione di enterocele', group: G.popR },
  { id: 'pop-levatorplastica', label: 'Miorrafia degli elevatori (levatorplastica)', group: G.popR },
  { id: 'pop-perineoplastica', label: 'Perineoplastica / perineorrafia', group: G.popR },
  { id: 'uro-sospensione-uterosacrale', label: 'Sospensione agli uterosacrali (McCall/Shull)', group: G.popR, kw: 'culdoplastica cupola' },
  { id: 'uro-sospensione-sacrospinosa', label: 'Sospensione al legamento sacrospinoso (Richter)', group: G.popR, kw: 'cupola SSLF' },
  { id: 'pop-isteropessi-sacrospinosa', label: 'Isteropessi sacrospinosa', group: G.popR, kw: 'uterus sparing' },
  { id: 'pop-ileococcigea', label: 'Sospensione ileococcigea', group: G.popR },
  { id: 'pop-manchester', label: 'Plicatura dei legamenti cardinali (Manchester-Fothergill)', group: G.popR },
  { id: 'uro-sacrocolpopessi', label: 'Sacrocolpopessi / sacroisteropessi', group: G.popR, legacy: true },
  { id: 'pop-sacrocolpopessi', label: 'Sacrocolpopessi (mesh)', group: G.popR, approach: 'laparoscopic', kw: 'LSC promontofissazione' },
  { id: 'pop-sacrocervicopessi', label: 'Sacrocervicopessi (mesh, dopo isterectomia subtotale)', group: G.popR, approach: 'laparoscopic', kw: 'cervicosacropessi LSC promontofissazione' },
  { id: 'pop-sacroisteropessi', label: 'Sacroisteropessi (mesh)', group: G.popR, approach: 'laparoscopic', kw: 'uterus sparing promontofissazione' },
  { id: 'pop-pectopessi', label: 'Pectopessi (pectopexy)', group: G.popR, approach: 'laparoscopic' },
  { id: 'pop-sospensione-laterale', label: 'Sospensione laterale (Dubuisson)', group: G.popR, approach: 'laparoscopic' },
  { id: 'pop-isteropessi-uterosacrale', label: 'Isteropessi uterosacrale', group: G.popR, approach: 'laparoscopic' },
  { id: 'uro-colpocleisi', label: 'Colpocleisi (Le Fort / totale)', group: G.popR, kw: 'obliterativa' },

  // Uroginecologia – incontinenza e altro
  { id: 'uro-sling-tot', label: 'Sling medio-uretrale transotturatorio (TOT/TVT-O)', group: G.uro, kw: 'IUS incontinenza' },
  { id: 'uro-sling-tvt', label: 'Sling medio-uretrale retropubico (TVT)', group: G.uro, kw: 'IUS incontinenza' },
  { id: 'uro-mini-sling', label: 'Mini-sling (single incision)', group: G.uro, kw: 'IUS incontinenza' },
  { id: 'uro-sling-autologo', label: 'Sling fasciale autologo (pubovaginale)', group: G.uro, kw: 'IUS incontinenza' },
  { id: 'uro-burch', label: 'Colposospensione sec. Burch', group: G.uro, approach: 'laparoscopic', kw: 'IUS incontinenza' },
  { id: 'uro-bulking', label: 'Iniezione di bulking agent uretrale', group: G.uro, approach: 'endoscopic', kw: 'IUS' },
  { id: 'uro-uretrolisi', label: 'Sezione di sling / uretrolisi', group: G.uro },
  { id: 'uro-botox', label: 'Tossina botulinica intravescicale', group: G.uro, approach: 'endoscopic', kw: 'OAB vescica iperattiva' },
  { id: 'uro-snm', label: 'Neuromodulazione sacrale', group: G.uro, approach: 'percutaneous', kw: 'SNM' },
  { id: 'uro-diverticolo', label: 'Diverticolectomia uretrale', group: G.uro },
  { id: 'uro-fistola', label: 'Riparazione fistola vescico/retto-vaginale', group: G.uro },
  { id: 'uro-cistoscopia', label: 'Cistoscopia', group: G.uro, approach: 'endoscopic' },
  { id: 'uro-pessario', label: 'Posizionamento pessario', group: G.uro, approach: 'na' },

  // Senologia
  { id: 'sen-biopsia', label: 'Biopsia mammaria (core/VAB)', group: G.breast, approach: 'percutaneous' },
  { id: 'sen-localizzazione', label: 'Centratura con repere (filo/ROLL/seme)', group: G.breast, approach: 'percutaneous' },
  { id: 'sen-nodulectomia', label: 'Nodulectomia / quadrantectomia', group: G.breast, legacy: true },
  { id: 'sen-tumorectomia', label: 'Tumorectomia (ampia escissione)', group: G.breast, kw: 'nodulectomia lumpectomia BCS' },
  { id: 'sen-quadrantectomia', label: 'Quadrantectomia', group: G.breast, kw: 'BCS conservativa' },
  { id: 'sen-oncoplastica', label: 'Chirurgia conservativa oncoplastica', group: G.breast, kw: 'BCS' },
  { id: 'sen-radicalizzazione', label: 'Radicalizzazione / ampliamento dei margini', group: G.breast },
  { id: 'sen-mastectomia-semplice', label: 'Mastectomia semplice (totale)', group: G.breast },
  { id: 'sen-mastectomia-skin-sparing', label: 'Mastectomia skin-sparing', group: G.breast, kw: 'SSM' },
  { id: 'sen-mastectomia-nipple-sparing', label: 'Mastectomia nipple-sparing', group: G.breast, kw: 'NSM' },
  { id: 'sen-mastectomia-radicale', label: 'Mastectomia radicale modificata', group: G.breast, kw: 'Madden Patey' },
  { id: 'sen-mastectomia-profilattica', label: 'Mastectomia di riduzione del rischio', group: G.breast, kw: 'BRCA profilattica' },
  { id: 'sen-dotti', label: 'Escissione dei dotti galattofori', group: G.breast, kw: 'Hadfield microdochectomia' },
  { id: 'sen-ascesso', label: 'Drenaggio di ascesso mammario', group: G.breast },
  { id: 'sen-ls-ascellare', label: 'Biopsia del linfonodo sentinella ascellare', group: G.axilla, kw: 'LS SLN' },
  { id: 'sen-dissezione-ascellare', label: 'Dissezione ascellare', group: G.axilla, kw: 'linfadenectomia ascellare ALND' },
  { id: 'sen-tad', label: 'Dissezione ascellare mirata (TAD)', group: G.axilla, kw: 'targeted' },
  { id: 'sen-espansore', label: 'Ricostruzione con espansore', group: G.recon },
  { id: 'sen-protesi', label: 'Ricostruzione con protesi (anche direct-to-implant)', group: G.recon },
  { id: 'sen-sostituzione-espansore', label: 'Sostituzione espansore con protesi', group: G.recon },
  { id: 'sen-lembo-diep', label: 'Ricostruzione con lembo autologo addominale', group: G.recon, kw: 'DIEP TRAM' },
  { id: 'sen-lembo-ld', label: 'Ricostruzione con lembo di gran dorsale', group: G.recon, kw: 'LD' },
  { id: 'sen-lipofilling', label: 'Lipofilling', group: G.recon },
  { id: 'sen-cap', label: 'Ricostruzione del complesso areola-capezzolo', group: G.recon, kw: 'CAP' },
  { id: 'sen-simmetrizzazione', label: 'Simmetrizzazione controlaterale', group: G.recon, kw: 'mastopessi mastoplastica riduttiva' },
  { id: 'sen-rimozione-protesi', label: 'Rimozione di protesi / capsulectomia', group: G.recon },
];

/** Interventions made of several procedures: picking one adds each part, each with its own role. */
export const PROCEDURE_COMBOS: VocabItem[] = [
  { id: 'combo-cervicosacropessi', label: 'Cervicosacropessi', parts: ['pop-isterectomia-subtotale', 'pop-sacrocervicopessi'] },
  { id: 'combo-isterectomia-sacrocolpopessi', label: 'Isterectomia totale + sacrocolpopessi', parts: ['pop-isterectomia-totale', 'pop-sacrocolpopessi'] },
  { id: 'combo-vh-mccall', label: 'Isterectomia vaginale + McCall + colporrafia anteriore e posteriore', parts: ['pop-isterectomia-vaginale', 'uro-sospensione-uterosacrale', 'uro-colporrafia-anteriore', 'pop-colporrafia-posteriore'] },
  { id: 'combo-manchester', label: 'Intervento di Manchester-Fothergill', parts: ['pop-amputazione-cervice', 'pop-manchester', 'uro-colporrafia-anteriore'] },
  { id: 'combo-colpocleisi', label: 'Colpectomia + colpocleisi + perineoplastica', parts: ['pop-colpectomia', 'uro-colpocleisi', 'pop-perineoplastica'] },
  { id: 'combo-tlh-bso', label: 'Isterectomia totale + annessiectomia bilaterale', parts: ['lps-isterectomia-totale', 'lps-annessiectomia-bi'] },
  { id: 'combo-tlh-salpingectomia', label: 'Isterectomia totale + salpingectomia bilaterale', parts: ['lps-isterectomia-totale', 'lps-salpingectomia-bi'] },
  { id: 'combo-endometrio', label: 'Stadiazione endometrio: isterectomia + annessiectomia bilaterale + linfonodo sentinella pelvico', parts: ['onc-isterectomia-totale-ext', 'lps-annessiectomia-bi', 'onc-ls-pelvico-bi'] },
  { id: 'combo-cervice-ls', label: 'Isterectomia radicale + annessiectomia bilaterale + linfonodo sentinella pelvico', parts: ['onc-isterectomia-radicale', 'lps-annessiectomia-bi', 'onc-ls-pelvico-bi'] },
  { id: 'combo-cervice-lnd', label: 'Isterectomia radicale + linfonodo sentinella + linfadenectomia pelvica', parts: ['onc-isterectomia-radicale', 'onc-ls-pelvico-bi', 'onc-linfadenectomia-pelvica'] },
  { id: 'combo-ovaio', label: 'Stadiazione ovaio completa (washing, isterectomia, annessi, omento, biopsie, linfadenectomia pelvica e lombo-aortica)', parts: ['onc-washing', 'onc-isterectomia-totale-ext', 'lps-annessiectomia-bi', 'onc-omentectomia-infracolica', 'onc-biopsie-peritoneali', 'onc-linfadenectomia-pelvica', 'onc-linfadenectomia-aortica'] },
  { id: 'combo-vulva', label: 'Vulvectomia radicale + linfonodo sentinella inguino-femorale bilaterale', parts: ['onc-vulvectomia-radicale', 'onc-ls-inguinale-bi'] },
  { id: 'combo-quadrantectomia-ls', label: 'Quadrantectomia + linfonodo sentinella ascellare', parts: ['sen-quadrantectomia', 'sen-ls-ascellare'] },
  { id: 'combo-mastectomia-espansore', label: 'Mastectomia + linfonodo sentinella + ricostruzione con espansore', parts: ['sen-mastectomia-skin-sparing', 'sen-ls-ascellare', 'sen-espansore'] },
  { id: 'combo-mastectomia-dissezione', label: 'Mastectomia + dissezione ascellare', parts: ['sen-mastectomia-radicale', 'sen-dissezione-ascellare'] },
  { id: 'combo-brca', label: 'Mastectomia di riduzione del rischio + annessiectomia bilaterale (RRSO)', parts: ['sen-mastectomia-profilattica', 'onc-rrso'] },
  { id: 'combo-tc-salpingectomia', label: 'Taglio cesareo + salpingectomia bilaterale', parts: ['ob-tc-elettivo', 'lps-salpingectomia-bi'] },
].map((c) => ({ ...c, group: 'Combinazioni – aggiunge più procedure' }));

/** Step of pelvic floor surgery a procedure belongs to, if any. */
export const procedurePhase = (id: string): 'Demolitivo' | 'Ricostruttivo' | undefined => {
  const g = PROCEDURES.find((p) => p.id === id)?.group;
  return g === G.popD ? 'Demolitivo' : g === G.popR ? 'Ricostruttivo' : undefined;
};

/** Access routes worth offering for a procedure (all of them for most). */
export function approachesFor(id: string): VocabItem[] {
  const g = PROCEDURES.find((p) => p.id === id)?.group;
  if (g === G.hys) return APPROACHES.filter((a) => a.id === 'hysteroscopic');
  if (g === G.breast || g === G.axilla || g === G.recon) return APPROACHES.filter((a) => ['open', 'percutaneous', 'robotic', 'endoscopic'].includes(a.id));
  return APPROACHES;
}

export function defaultApproach(id: string): string | undefined {
  const p = PROCEDURES.find((x) => x.id === id);
  return p?.approach ?? (p?.group ? GROUP_APPROACH[p.group] : undefined);
}

export const SURGICAL_ROLES: VocabItem[] = [
  { id: 'first', label: 'Primo operatore' },
  { id: 'first-tutored', label: 'Primo operatore con tutor' },
  { id: 'second', label: 'Secondo operatore' },
  { id: 'assistant', label: 'Aiuto / assistente' },
  { id: 'observer', label: 'Osservatore' },
];

export const APPROACHES: VocabItem[] = [
  { id: 'vaginal', label: 'Vaginale' },
  { id: 'laparoscopic', label: 'Laparoscopico' },
  { id: 'robotic', label: 'Robotico' },
  { id: 'open', label: 'Open / laparotomico' },
  { id: 'vnotes', label: 'vNOTES' },
  { id: 'hysteroscopic', label: 'Isteroscopico' },
  { id: 'endoscopic', label: 'Endoscopico/cistoscopico' },
  { id: 'percutaneous', label: 'Ecoguidato/percutaneo' },
  { id: 'na', label: 'Non applicabile' },
];

export const SETTINGS_URGENCY: VocabItem[] = [
  { id: 'elective', label: 'Elezione' },
  { id: 'urgent', label: 'Urgenza' },
  { id: 'emergency', label: 'Emergenza' },
];

export const CLAVIEN: VocabItem[] = [
  { id: 'none', label: 'Nessuna complicanza' },
  { id: 'I', label: 'Clavien-Dindo I' },
  { id: 'II', label: 'Clavien-Dindo II' },
  { id: 'IIIa', label: 'Clavien-Dindo IIIa' },
  { id: 'IIIb', label: 'Clavien-Dindo IIIb' },
  { id: 'IVa', label: 'Clavien-Dindo IVa' },
  { id: 'IVb', label: 'Clavien-Dindo IVb' },
  { id: 'V', label: 'Clavien-Dindo V' },
];

export const CLINICAL_ACTIVITIES: VocabItem[] = [
  { id: 'amb-gin', label: 'Visita ginecologica', group: 'Ambulatorio' },
  { id: 'amb-ost', label: 'Visita ostetrica', group: 'Ambulatorio' },
  { id: 'amb-gravidanza-rischio', label: 'Ambulatorio gravidanza a rischio', group: 'Ambulatorio' },
  { id: 'amb-termine', label: 'Ambulatorio gravidanza a termine', group: 'Ambulatorio' },
  { id: 'amb-uroginecologia', label: 'Visita uroginecologica', group: 'Ambulatorio' },
  { id: 'amb-oncologia', label: 'Visita / follow-up oncologico', group: 'Ambulatorio' },
  { id: 'amb-senologia', label: 'Visita senologica', group: 'Ambulatorio' },
  { id: 'amb-endometriosi', label: 'Ambulatorio endometriosi / dolore pelvico', group: 'Ambulatorio' },
  { id: 'amb-menopausa', label: 'Ambulatorio menopausa', group: 'Ambulatorio' },
  { id: 'amb-pma', label: 'Ambulatorio infertilità / PMA', group: 'Ambulatorio' },
  { id: 'amb-contraccezione', label: 'Contraccezione / consultorio', group: 'Ambulatorio' },
  { id: 'amb-preoperatorio', label: 'Visita preoperatoria / prericovero', group: 'Ambulatorio' },
  { id: 'eco-ostetrica-1t', label: 'Ecografia ostetrica I trimestre', group: 'Ecografia' },
  { id: 'eco-morfologica', label: 'Ecografia morfologica', group: 'Ecografia' },
  { id: 'eco-accrescimento', label: 'Ecografia accrescimento/doppler', group: 'Ecografia' },
  { id: 'eco-cervicometria', label: 'Cervicometria', group: 'Ecografia' },
  { id: 'eco-ginecologica', label: 'Ecografia ginecologica TV', group: 'Ecografia' },
  { id: 'eco-ginecologica-2l', label: 'Ecografia ginecologica II livello (IOTA/oncologica)', group: 'Ecografia' },
  { id: 'eco-pavimento', label: 'Ecografia pavimento pelvico', group: 'Ecografia' },
  { id: 'eco-mammaria', label: 'Ecografia mammaria', group: 'Ecografia' },
  { id: 'colposcopia', label: 'Colposcopia', group: 'Diagnostica' },
  { id: 'pap-hpv', label: 'Pap test / HPV test', group: 'Diagnostica' },
  { id: 'biopsia-endometriale', label: 'Biopsia endometriale ambulatoriale', group: 'Diagnostica' },
  { id: 'isteroscopia-office', label: 'Isteroscopia office', group: 'Diagnostica' },
  { id: 'urodinamica', label: 'Esame urodinamico', group: 'Diagnostica' },
  { id: 'pessario-controllo', label: 'Posizionamento / controllo pessario', group: 'Diagnostica' },
  { id: 'ctg', label: 'Lettura CTG', group: 'Sala parto' },
  { id: 'sala-parto-travagli', label: 'Travaglio seguito', group: 'Sala parto' },
  { id: 'induzione', label: 'Induzione del travaglio', group: 'Sala parto' },
  { id: 'ps-ostgin', label: 'Valutazione in PS ostetrico-ginecologico', group: 'Urgenza' },
  { id: 'consulenza', label: 'Consulenza in altro reparto', group: 'Urgenza' },
  { id: 'reparto-pazienti', label: 'Paziente seguita in reparto', group: 'Reparto' },
  { id: 'reparto-dimissione', label: 'Dimissione', group: 'Reparto' },
  { id: 'ca-ambulatoriale', label: 'Visita ambulatoriale', group: 'Guardia medica' },
  { id: 'ca-domiciliare', label: 'Visita domiciliare', group: 'Guardia medica' },
  { id: 'ca-telefonica', label: 'Consulto telefonico', group: 'Guardia medica' },
];

/** Who did the clinical activity. */
export const CLINICAL_ROLES: VocabItem[] = [
  { id: 'autonomous', label: 'Autonomia' },
  { id: 'supervised', label: 'Supervisione' },
  { id: 'observer', label: 'Osservazione' },
];

export const STUDY_TYPES: VocabItem[] = [
  { id: 'article', label: 'Lettura articoli' },
  { id: 'book', label: 'Libro / manuale' },
  { id: 'guideline', label: 'Linee guida' },
  { id: 'course', label: 'Corso / FAD' },
  { id: 'congress', label: 'Congresso' },
  { id: 'webinar', label: 'Webinar' },
  { id: 'lesson', label: 'Lezione specializzazione' },
  { id: 'video', label: 'Video chirurgico' },
  { id: 'simulation', label: 'Simulazione / pelvic trainer' },
  { id: 'writing', label: 'Scrittura paper / tesi' },
  { id: 'teaching', label: 'Didattica ad altri' },
];

export const STUDY_AREAS: VocabItem[] = [
  { id: 'obstetrics', label: 'Ostetricia' },
  { id: 'fetal-medicine', label: 'Medicina materno-fetale' },
  { id: 'gynecology', label: 'Ginecologia' },
  { id: 'urogynecology', label: 'Uroginecologia' },
  { id: 'oncology', label: 'Oncologia ginecologica' },
  { id: 'endometriosis', label: 'Endometriosi' },
  { id: 'reproductive', label: 'Medicina della riproduzione' },
  { id: 'ultrasound', label: 'Ecografia' },
  { id: 'surgery', label: 'Tecnica chirurgica' },
  { id: 'research', label: 'Ricerca / statistica' },
  { id: 'other', label: 'Altro' },
];

// ---------- Palestra ----------

export const WORKOUT_TYPES: VocabItem[] = [
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
  { id: 'legs', label: 'Legs' },
  { id: 'strength', label: 'Pesi / forza' },
  { id: 'hypertrophy', label: 'Ipertrofia' },
  { id: 'functional', label: 'Funzionale / cross training' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'run', label: 'Corsa' },
  { id: 'bike', label: 'Bici' },
  { id: 'swim', label: 'Nuoto' },
  { id: 'walk', label: 'Camminata / trekking' },
  { id: 'yoga', label: 'Yoga / mobilità' },
  { id: 'sport', label: 'Sport di squadra / racchetta' },
  { id: 'other', label: 'Altro' },
];

export const EXERCISES: VocabItem[] = [
  { id: 'squat', label: 'Squat', group: 'Gambe' },
  { id: 'front-squat', label: 'Front squat', group: 'Gambe' },
  { id: 'leg-press', label: 'Leg press', group: 'Gambe' },
  { id: 'lunge', label: 'Affondi', group: 'Gambe' },
  { id: 'rdl', label: 'Stacco rumeno', group: 'Gambe' },
  { id: 'leg-curl', label: 'Leg curl', group: 'Gambe' },
  { id: 'leg-extension', label: 'Leg extension', group: 'Gambe' },
  { id: 'hip-thrust', label: 'Hip thrust', group: 'Gambe' },
  { id: 'calf', label: 'Calf raise', group: 'Gambe' },
  { id: 'deadlift', label: 'Stacco da terra', group: 'Schiena' },
  { id: 'pull-up', label: 'Trazioni', group: 'Schiena' },
  { id: 'lat-pulldown', label: 'Lat machine', group: 'Schiena' },
  { id: 'barbell-row', label: 'Rematore bilanciere', group: 'Schiena' },
  { id: 'cable-row', label: 'Pulley', group: 'Schiena' },
  { id: 'bench', label: 'Panca piana', group: 'Petto' },
  { id: 'incline-bench', label: 'Panca inclinata', group: 'Petto' },
  { id: 'dips', label: 'Dip', group: 'Petto' },
  { id: 'push-up', label: 'Piegamenti', group: 'Petto' },
  { id: 'chest-fly', label: 'Croci', group: 'Petto' },
  { id: 'ohp', label: 'Military press', group: 'Spalle' },
  { id: 'lateral-raise', label: 'Alzate laterali', group: 'Spalle' },
  { id: 'face-pull', label: 'Face pull', group: 'Spalle' },
  { id: 'curl', label: 'Curl bicipiti', group: 'Braccia' },
  { id: 'triceps', label: 'Push-down tricipiti', group: 'Braccia' },
  { id: 'plank', label: 'Plank', group: 'Core' },
  { id: 'crunch', label: 'Crunch / addominali', group: 'Core' },
  { id: 'hanging-leg', label: 'Leg raise alla sbarra', group: 'Core' },
];

// ---------- Vita privata ----------

export const OUTING_TYPES: VocabItem[] = [
  { id: 'trip', label: 'Gita' },
  { id: 'travel', label: 'Viaggio' },
  { id: 'dinner', label: 'Cena / aperitivo' },
  { id: 'friends', label: 'Uscita con amici' },
  { id: 'family', label: 'Famiglia' },
  { id: 'culture', label: 'Cinema / teatro / mostra' },
  { id: 'concert', label: 'Concerto / evento' },
  { id: 'nature', label: 'Natura / montagna' },
  { id: 'other', label: 'Altro' },
];

// ---------- Categorie generali (impegni, promemoria, note) ----------

export const CATEGORIES: VocabItem[] = [
  { id: 'lavoro', label: 'Lavoro' },
  { id: 'studio', label: 'Studio / formazione' },
  { id: 'salute', label: 'Salute' },
  { id: 'sport', label: 'Sport' },
  { id: 'famiglia', label: 'Famiglia' },
  { id: 'amici', label: 'Amici' },
  { id: 'casa', label: 'Casa' },
  { id: 'burocrazia', label: 'Burocrazia' },
  { id: 'finanze', label: 'Finanze' },
  { id: 'svago', label: 'Svago' },
  { id: 'altro', label: 'Altro' },
];

// ---------- Default settings ----------

/** Guardia medica (continuità assistenziale), fuori dal tabellone di reparto. */
const CA_SHIFT_TYPES: ShiftType[] = [
  { id: 'ca-notturno', name: 'Guardia medica notturna', start: '20:00', end: '08:00', color: '#4a4e69', countsAsWork: true, group: 'Guardia medica' },
  { id: 'ca-prefestivo', name: 'Guardia medica prefestivo', start: '08:00', end: '20:00', color: '#7a8fa6', countsAsWork: true, group: 'Guardia medica' },
  { id: 'ca-festivo', name: 'Guardia medica festivo', start: '08:00', end: '20:00', color: '#8d7aa6', countsAsWork: true, group: 'Guardia medica' },
];

export const DEFAULT_SHIFT_TYPES: ShiftType[] = [...ROSTER_SHIFT_TYPES, ...CA_SHIFT_TYPES];

/** Ids of the generic shift types shipped before the department roster (seed 1). */
const SEED1_SHIFT_IDS = new Set([
  'mattino', 'pomeriggio', 'giornata', 'notte', 'guardia-24', 'sala-operatoria', 'sala-parto', 'ambulatorio',
  'reperibilita', 'ca-notturno', 'ca-prefestivo', 'ca-festivo', 'smonto', 'riposo', 'ferie',
]);

export const SEED_VERSION = 2;

export function defaultSettings(): Settings {
  return {
    colleagues: ROSTER_COLLEAGUES,
    shiftTypes: DEFAULT_SHIFT_TYPES,
    gcal: { enabled: false, calendarId: 'primary', readCalendarIds: ['primary'] },
    seed: SEED_VERSION,
    updatedAt: 0,
  };
}

/**
 * Brings saved settings up to the current defaults without losing user edits:
 * seed 2 swaps the generic shift types for the department codes (custom types
 * are kept) and adds the roster colleagues missing by name.
 */
export function migrateSettings(s: Settings): Settings {
  if ((s.seed ?? 1) >= SEED_VERSION) return s;
  const custom = s.shiftTypes.filter((t) => !SEED1_SHIFT_IDS.has(t.id) && !DEFAULT_SHIFT_TYPES.some((d) => d.id === t.id));
  const known = new Set(s.colleagues.map((c) => c.name.trim().toLowerCase()));
  const extra = ROSTER_COLLEAGUES.filter((c) => !known.has(c.name.toLowerCase()));
  return { ...s, shiftTypes: [...DEFAULT_SHIFT_TYPES, ...custom], colleagues: [...extra, ...s.colleagues], seed: SEED_VERSION };
}

/** Exercise label: standardized Italian name, or the Hevy name for unmapped exercises. */
export function exerciseLabel(id: string): string {
  return id.startsWith('hevy:') ? id.slice(5) : labelOf(EXERCISES, id);
}

export function labelOf(list: VocabItem[], id: string | undefined): string {
  if (!id) return '';
  return list.find((v) => v.id === id)?.label ?? id;
}

export function grouped(list: VocabItem[]): [string, VocabItem[]][] {
  const map = new Map<string, VocabItem[]>();
  for (const item of list) {
    const g = item.group ?? '';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }
  return [...map.entries()];
}
