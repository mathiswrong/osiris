const DISEASE = /\b(?:plague|pneumoni[ac]|cholera|ebola|marburg|mpox|monkeypox|measles|nipah|hantavirus|dengue|chikungunya|polio|smallpox|anthrax|malaria|influenza|bird flu|h5n1|salmonella|e\.?\s?coli|legionella|lassa fever|yellow fever|zika|foot.and.mouth|covid(?:-19)?|(?:unknown|unidentified|mystery|mysterious|unexplained|dangerous) (?:illness|disease|infection|virus|pathogen|deaths?))\b/i;
const INCIDENT = /\b(?:cases?|deaths?|dead|die[sd]?|dying|kill(?:s|ed|ing)?|infect\w*|spread\w*|outbreaks?|epidemics?|pandemics?|suspect\w*|report\w*|monitor\w*|hospitali[sz]\w*|patients?|expos\w*|unknown|unexplained|mystery|mysterious|resurfac\w*)\b/i;
const CONTAINMENT = /\b(?:quarantin(?:e[ds]?|ing)|contact tracing|anti-epidemic measures|health emergency|disease cluster|unusual cluster)\b/i;
const HISTORICAL = /\b(?:ancient|medieval|archaeolog\w*|earliest known|history of|historical|\d[\d,]*\s+years? ago|\d+(?:st|nd|rd|th)[ -]century)\b/i;

/** A reporting lead to investigate; it establishes neither diagnosis nor transmission. */
export function healthSignal(title: string, excerpt = ""): boolean {
  if (HISTORICAL.test(title)) return false;
  const lead = `${title}\n${excerpt.slice(0, 800)}`.replace(/\s+/g, " ");
  // ponytail: English headline/lead rules; add language-specific rules when those feeds are connected.
  return (CONTAINMENT.test(lead) && !/\b(?:malware|software|computer virus)\b/i.test(lead)) ||
    (DISEASE.test(lead) && INCIDENT.test(lead)) ||
    /\b(?:epidemics?|pandemics?)\b/i.test(lead) ||
    (/\boutbreaks?\b/i.test(lead) && /\b(?:disease|illness|infection|virus|bacteri\w*)\b/i.test(lead));
}
