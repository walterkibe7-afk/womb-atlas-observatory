export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "luo", name: "Luo", nativeName: "Dholuo" },
  { code: "kik", name: "Kikuyu", nativeName: "Gĩkũyũ" },
];
