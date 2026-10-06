import { describe, expect, it } from "vitest";
import { healthSignal } from "./health-signals";

describe("current public health reporting", () => {
  it("recognizes suspected disease, unknown illness and containment without requiring confirmation", () => {
    for (const title of [
      "Irkutsk plague institute worker dies of pneumonia of unknown origin",
      "Officials deny suspected plague after hospital quarantine in Siberia",
      "Hospital closes wards for contact tracing in Shelekhov",
      "Unexplained deaths reported in remote village",
      "Suspected cholera cases reported in Sudan",
      "Mpox infections rise in Congo",
      "Ebola disease caused by Bundibugyo virus - Democratic Republic of the Congo",
      "Malaria outbreak in Mozambique",
      "E. coli cases reported in Australia",
      "Suspected foot-and-mouth outbreak in Russia",
      "Mysterious illness in Mongolia",
    ]) expect(healthSignal(title, "New cases have been reported.")).toBe(true);
    expect(healthSignal("Officials investigate death", "A patient in Irkutsk died with pneumonia of unknown cause.")).toBe(true);
  });

  it("keeps historical reporting, metaphors, technical quarantine and routine news out", () => {
    for (const title of [
      "Ancient plague outbreak in Russia found in 5,500-year-old teeth",
      "The earliest known plague outbreak happened in Russia 5,500 years ago",
      "History of the medieval plague in Europe",
      "Software bugs plague the new dashboard",
      "Antivirus quarantines malware samples",
      "Outbreak of violence at the football stadium",
      "Hospital receives new equipment",
      "Study of a new pneumonia vaccine published",
      "Plague research institute opens a new laboratory",
    ]) expect(healthSignal(title)).toBe(false);
    expect(healthSignal("Lab worker dies of suspected plague; this is not the Black Death")).toBe(true);
  });
});
