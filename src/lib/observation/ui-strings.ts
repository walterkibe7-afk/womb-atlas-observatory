/**
 * Chrome strings for the observation wizard — the wrapper text around the
 * form content (nav buttons, the safety banner) rather than the screens and
 * questions themselves, which come from the form definition.
 *
 * These used to be hardcoded English literals in the components, so a Spanish
 * participant saw translated questions inside an English frame. They now flow
 * through the same `FormTranslation` tables as everything else, under a `UI.`
 * key prefix, which means they are editable in the admin Translations page and
 * are picked up by `loadTranslationMap` like any other key.
 *
 * The values here are the English source AND the fallback: any locale missing a
 * row renders English rather than a blank, matching the rest of the pipeline.
 */
export const UI_STRINGS = {
  back: "Back",
  cancel: "Cancel",
  continue: "Continue",
  finish: "Finish",
  saveAndContinue: "Save & continue",
  saveSelection: "Save selection",
  saving: "Saving…",
  skipSection: "Skip this section",
  safetyCheckNotice:
    "This is a quick safety check. Womb Atlas is not an emergency service and does not provide a diagnosis.",

  // Clinical and legal copy. These were literals inside the components, which
  // meant a participant reading the flow in Swahili still got the safety
  // guidance and the consent framing in English — the exact problem the nav
  // buttons above were moved here to solve. Treat any change as sign-off
  // material rather than routine copy editing.
  safetyAlertGuidance:
    "If your symptoms feel severe or unsafe, please contact a healthcare provider, urgent care, or your local emergency number. This guidance is not a diagnosis.",
  consentNotice:
    "Your responses are observational and reflective. Womb Atlas does not provide a medical diagnosis. You can stop at any time.",
  recordDisclaimer: "This Atlas Record is observational and reflective. It is not a diagnosis",
  recordDisclaimerOffline: " (generated offline).",
  recordDisclaimerEnd: ".",

  // Wizard body copy.
  narrativeHelp:
    "You can type, record audio, or both — whatever feels easiest. Audio is saved and a written transcript is created automatically.",
  reviewIntro: "Review your responses before creating your reflection. You can edit any section.",
  patternsIntro:
    "Atlas shows only patterns observed in this first record, in plain language and without treating them as a diagnosis.",
  noStrongPatterns:
    "No strong patterns were observed. Your record is still valuable for future comparison.",
  subduedHeading: "What Atlas didn't notice strongly in this record",
  consentOptionalNote: "Optional — these choices are separate from taking part.",

  // Reflection chamber — tab labels, the hint under each tab, and the card
  // headings inside them.
  chamberTitle: "How Atlas understood your record",
  chamberEyebrow: "Observatory Briefing",
  tabObservation: "Observation",
  tabObserved: "Observed",
  tabUnderstanding: "Understanding",
  tabWatch: "Watch",
  tabEvidence: "Evidence",
  hintNoticed: "What Atlas noticed",
  hintUnderstood: "How Atlas understood it",
  hintConnected: "Why Atlas connected it",
  hintWatch: "What Atlas will watch",
  hintBelieves: "Why Atlas believes it",
  proseAiAssisted: "AI-assisted wording · observational, not a diagnosis",
  proseDeterministic: "Written from your answers · observational, not a diagnosis",
  cardArchetype: "Your Archetype",
  cardNoticed: "What Atlas noticed",
  cardSupportingPatterns: "Supporting patterns",
  cardUnderstoodThis: "How Atlas understood this",
  cardConnectedThem: "Why Atlas connected them",
  cardWillWatch: "What Atlas will continue watching",
  cardBelievesThis: "Why Atlas believes this",
  cardNarrativeThemes: "Narrative Themes",
  cardLearnedThis: "How Atlas learned this",
  cardCompleteRecord: "Complete Atlas Record",
  confidenceSignal: "Signal Confidence",
  confidencePattern: "Pattern Confidence",
  confidenceConnection: "Connection Confidence",

  // Narrative prompt card — the free-text box and the voice recorder around it.
  narrativePlaceholder: "Share in your own words (optional)...",
  narrativeRecord: "Record your voice instead",
  narrativeTapToStart: "Tap to start",
  narrativeStopRecording: "Stop recording",
  narrativeSavingTranscribing: "Saving & transcribing…",
  narrativeRemoveAudio: "Remove",
  narrativeAudioSaved: "Audio saved. A written transcript will appear here once Speech-to-Text is connected.",
  narrativePromptCounter: "Prompt",
  narrativeMicDenied: "Microphone unavailable or permission denied.",
  narrativeUploadFailed: "Upload failed. Please try again.",
  narrativeAnswerFirst: "Couldn't attach audio — please answer a question first.",

  // Review screen controls and the boolean answers it renders. These were
  // literals, so a French participant saw "Edit" and "Yes" among translated
  // answers.
  edit: "Edit",
  answer: "Answer",
  skipped: "Skipped",
  yes: "Yes",
  no: "No",

  landingBoundaryLead: "Womb Atlas observes.",
  landingBoundaryRest: "It does not diagnose, predict, or replace professional healthcare.",
  reflectionFallback:
    "Your responses describe experiences that may be worth continuing to observe over time.",

  // Record section headings.
  sectionArchetypeMeaning: "What this archetype means",
  sectionArchetypeReason: "Why Atlas chose this archetype",
  sectionStrengths: "Strengths Atlas observed",
  sectionWhatWeObserve: "What We Observe",

  // /choose-language — the one-time, permanent language gate shown right
  // after first sign-in. Rendered in the language just tapped, before it's
  // committed, which is why this needs its own translated strings rather
  // than reusing an English confirm dialog.
  confirmLanguageTitle: "Confirm your language",
  confirmLanguageBody:
    "This can't be changed later — your records will be saved in this language from now on.",
  confirmLanguageButton: "Continue",
  changeSelection: "Choose a different language",

  // Sidebar — the participant portal shell, on screen on every page.
  navMyObservatory: "My Observatory",
  navBeginFirstObservation: "Begin First Observation",
  navCheckIn: "Atlas Check-In",
  navTimeline: "Atlas Timeline",
  navRecords: "My Records",
  navReflections: "Reflections",
  sidebarYourCompanion: "Your Companion",
  sidebarCompanionRoleLine1: "Midwife &",
  sidebarCompanionRoleLine2: "Women's Health Guide",
  sidebarMessageCompanion: "Message Aminata",
  sidebarPrivacyTitle: "Private. Secure. Yours.",
  sidebarPrivacyBody: "You are in control of your data.",
  logOut: "Log Out",

  // Dashboard ("My Observatory") — headers and labels around the live data.
  participantFallbackName: "Participant",
  dashboardWelcomeBack: "Welcome back",
  dashboardIntro:
    "This is your personal observatory. Track your patterns, understand your signals, and see your journey unfold over time.",
  dashboardYourJourney: "Your Journey",
  dashboardContinueYourJourney: "Continue Your Journey",
  dashboardFirstObservationComplete: "First Observation Complete",
  dashboardJourneyRecordedBody: "Your baseline observation is recorded. You can review or refine it anytime.",
  dashboardJourneyOngoingBody: "You're on a journey of understanding your health over time.",
  dashboardPercentComplete: "complete",
  dashboardReview: "Review",
  dashboardContinue: "Continue",
  dashboardYourHealthJourney: "Your Health Journey",
  statFirst: "First",
  statObservation: "Observation",
  statLatest: "Latest",
  statAtlas: "Atlas",
  statRecords: "Records",
  statObservationStreak: "Streak",
  donutJourneyProgressLine1: "Your journey",
  donutJourneyProgressLine2: "progress",
  dashboardYourCompanion: "Your Companion",
  dashboardTalkToCompanion: "Talk to Aminata",
  dashboardAtlasTimeline: "Atlas Timeline",
  dashboardViewFullTimeline: "View full timeline",
  dashboardPersonalInsights: "Personal Insights",
  dashboardPersonalInsightsIntro: "Insights about you, based on your data.",
  dashboardExploreMorePersonalInsights: "Explore more personal insights",
  dashboardObservatoryInsights: "Observatory Insights",
  dashboardObservatoryInsightsIntro: "Insights from women with similar experiences.",
  dashboardExploreObservatoryInsights: "Explore observatory insights",
  dashboardNextCheckIn: "Next Check-In",
  dashboardNextCheckInDue: "Your next check-in is due in",
  dashboardCheckInReadyNow: "Ready now",
  dashboardCheckInDays: "days",
  dashboardCheckInAfterFirstRecord: "After first record",
  dashboardCheckInWheneverReady: "or whenever you're ready",
  dashboardStartCheckIn: "Start Check-In",
  dashboardYourContribution: "Your Contribution",
  dashboardContributionIntro: "Your observations help improve women's health globally.",
  dashboardAtlasRecordsContributed: "Atlas Records Contributed",
  dashboardCountriesRepresented: "Countries Represented",
  dashboardSeeImpact: "See the impact of your contribution",
  dashboardYourReflection: "Your Reflection",
  dashboardReflectionLatest: "Latest",
  dashboardReflectionBurden: "burden",
  dashboardViewAllReflections: "View all reflections",
  dashboardReflectionIntro:
    "We heard you. Your reflection is a summary of what you shared and what matters most to you.",
  dashboardReflectionFallback: "Your reflection will appear here once you complete your first observation.",
  dashboardCompareReflection: "Compare to Previous Reflection",
  dashboardViewReflection: "View Reflection",
  dashboardAtlasIntelligence: "Atlas Intelligence",
  intelObservedPatterns: "Observed Patterns",
  intelObservedPatternsSub: "What Atlas is observing",
  intelReflection: "Reflection",
  intelReflectionSub: "Atlas' understanding of your patterns",
  intelTrajectory: "Trajectory",
  intelTrajectorySub: "How your patterns evolve over time",
  intelKnowledge: "Knowledge",
  intelKnowledgeSub: "Personalized insights & education",
  dashboardSignalEvolution: "Signal Evolution",
  dashboardViewFullChart: "View full chart",
  dashboardSignalEvolutionIntro: "How each domain has moved across your records.",
  dashboardSignalEvolutionDisclaimer: "Trends are based on your self-reported data and are not a diagnosis.",
  privacyBelongsToYou: "Your experience belongs to you.",
  privacyYouControlData: "You control your data.",
  privacyNeverSell: "We never sell your data.",
  privacyEver: "Ever.",
  privacyDeleteExport: "You can delete or export",
  privacyYourDataAnytime: "your data anytime.",
  privacyLearnMore: "Learn more about privacy",

  // Timeline — the trajectory/care-journey view.
  timelineTitle: "Atlas Timeline & Trajectory Engine",
  timelineSubtitle: "Your health story over time. Every observation builds understanding.",
  timelineRangeAll: "All",
  timelineNewCheckIn: "New Check-In",
  timelineTocAtlasTimeline: "Atlas Timeline",
  timelineTocHealthJourney: "Health Journey",
  timelineTocSignalEvolution: "Signal Evolution",
  timelineTocCareJourney: "Care Journey",
  timelineTocLifeStage: "Life Stage Journey",
  timelineTocTrajectory: "Trajectory Overview",
  timelineTocCheckIns: "Check-Ins",
  timelineTocMilestones: "Milestones",
  timelineTools: "Tools",
  timelineExport: "Export Timeline",
  timelineShare: "Share Journey",
  timelinePrint: "Print Summary",
  timelineHealthJourney: "Health Journey",
  timelineHealthJourneyEmpty: "Your health journey will appear here after your first observation.",
  timelineSignalEvolutionOverTime: "Signal Evolution Over Time",
  timelineSignalEvolutionSub: "How your constellation domains have shifted across records.",
  timelineCareJourney: "Care Journey",
  timelineCareJourneyEmpty: "Begins once you complete your first observation.",
  timelineCurrentPhase: "Current phase:",
  timelineLifeStage: "Life Stage Journey",
  lifeStageAdolescence: "Adolescence",
  lifeStageReproductive: "Reproductive Years",
  lifeStagePregnancy: "Pregnancy",
  lifeStagePostpartum: "Postpartum",
  lifeStagePerimenopause: "Perimenopause",
  lifeStageMenopause: "Menopause",
  timelineYouAreIn: "You are in your",
  timelineLifeStageEmpty: "Share your context in your first observation to see this here.",
  timelineTrajectoryOverview: "Trajectory Overview",
  timelineObservationsTotal: "Observations Total",
  timelineCheckinsCompleted: "Check-Ins Completed",
  timelineDomainsTracked: "Domains Tracked",
  timelineOverallTrend: "Overall Trend",
  timelineTrendImproving: "Improving",
  timelineTrendNeedsAttention: "Needs Attention",
  timelineTrendStable: "Stable",
  timelineMostImpacted: "Most impacted:",
  timelineStillTracking: "Still tracking:",
  timelineNextSteps: "Next Steps",
  timelineStepContinueCheckIns: "Continue regular check-ins",
  timelineStepTrackSignals: "Track signals over time",
  timelineStepAddReflection: "Add a reflection",
  timelineStepViewCareJourney: "View your care journey",
  timelineCheckInWidgetTitle: "Atlas Check-In",
  timelineCheckInWidgetBody: "Since your last observation, keep Atlas updated on what has changed.",
  timelineStartCheckIn: "Start Check-In",
  timelineMilestones: "Milestones",
  timelineMilestonesEmpty: "Your milestones will appear as your journey grows.",
  trendIncreasing: "Increasing",

  // Records — the list of Atlas Records.
  recordsLoading: "Loading your Atlas Records…",
  recordsEmptyTitle: "No Atlas Records yet",
  recordsEmptyBody:
    "Complete your first observation to generate your first Atlas Record — a constellation of the patterns Atlas observed in what you shared.",
  recordsBeginFirstObservation: "Begin First Observation",
  recordsTitle: "My Atlas Records",
  recordsSubtitle: "Your validated health patterns, mapped as a constellation.",
  recordsSearchPlaceholder: "Search records…",
  recordsSignalsValidated: "Signals Validated",
  recordsCheckInBadge: "Check-In",
  recordsNoMatch: "No records match your search.",
  recordsAtlasObserved: "Atlas Observed",
  recordsConstellationTitle: "Observation Constellation",
  recordsConstellationUnavailable:
    "The interactive constellation isn't available for this record. The record summary below still reflects what Atlas observed.",
  recordsObservedDomains: "Observed Domains",
  recordsNoStrongPatterns: "No strong patterns were observed in this record.",

  // Reflections — the Reflection Chamber list view.
  reflectionsLoading: "Loading your reflections…",
  reflectionsEmptyTitle: "No reflections yet",
  reflectionsEmptyBody:
    "Complete your first observation and Atlas will compose a reflection — a summary of what you shared and what matters most to you.",
  reflectionsBeginFirstObservation: "Begin First Observation",
  reflectionsTitle: "Your Reflections",
  reflectionsSubtitle: "How Atlas heard and organized what you shared, over time.",
  reflectionsNonDiagnosticBoundary: "Non-Diagnostic Boundary.",
  reflectionsDisclaimerFallback: "Atlas observes and reflects on your patterns. It does not provide a medical diagnosis.",
  reflectionsDefaultArchetype: "Atlas Reflection",
  reflectionsComparedTo: "Compared to your previous reflection",
  reflectionsScoresSteady: "Your constellation scores held steady since your last record.",
  reflectionsWhatThisMayMean: "What this may mean",
  reflectionsBeingPrepared: "Your reflection is being prepared.",

  // Burden Level display labels. The underlying value stays the fixed English
  // enum ("Low"/"Moderate"/"High") everywhere it's computed, stored, or used
  // for styling (burdenBadgeClass) — only what's shown to the participant is
  // localized, via burdenLabel() below.
  burdenLow: "Low",
  burdenModerate: "Moderate",
  burdenHigh: "High",
  burdenLabelPrefix: "Burden:",
  pleaseDescribe: "please describe",
  typeYourAnswer: "Type your answer here...",

  // The "Your Atlas Record" / "Observed Patterns" / "Your Reflection" screens
  // (ScreenRenderer.tsx, inside the wizard) and their read-view mirror
  // (atlas-record-detail.tsx, on the Records page) — two independent copies
  // of the same layout, both wired to these same keys.
  reflectionScreenTitle: "Your Reflection",
  sectionAtlasArchetype: "Atlas Archetype",
  reflectionWhatAppearsConnected: "What appears connected",
  reflectionStrengthsObserved: "Strengths observed",
  constellationRecordTitle: "Constellation Record",
  observedPatternsTitle: "Observed Patterns",
  atlasObservedLabel: "Atlas observed",
  relatedPatternPrefix: "Related pattern:",
  yourAtlasRecordTitle: "Your Atlas Record",
  observationValidated: "Observation Validated",
  sectionObservationPortrait: "Observation Portrait",
  sectionDominantPattern: "Dominant Pattern",
  sectionSignalLandscape: "Signal Landscape",
  sectionExperienceLayers: "Experience Layers",
  sectionReflection: "Reflection",
  sectionBodyLiteracy: "Body Literacy",
  sectionWhatAtlasWillWatch: "What Atlas Will Watch",
  sectionReflectionCompass: "Reflection Compass",
  compassStrongestTheme: "Strongest Theme",
  compassEmergingTheme: "Emerging Theme",
  compassStrengthObserved: "Strength Observed",
  downloadRecordButton: "Download Record",
  preparingRecord: "Preparing your record…",

  // Reflection Chamber (reflection-chamber-ui.tsx) — the tab chrome, not the
  // pattern/signal content itself (that's the AIKB registry, translated
  // separately). Confidence/watch-status enum labels mirror burdenLabel's
  // pattern: the underlying value stays a fixed English key, only the
  // display text is localized.
  chamberObservedBecause: "Observed because",
  chamberDominantPattern: "Dominant pattern",
  chamberWhyThisMatters: "Why this matters",
  chamberShowLess: "Show less",
  chamberLearnMore: "Learn more",
  chamberViewReasoning: "View reasoning →",
  chamberNoDominantPatternYet: "No dominant pattern surfaced yet. This remains a light baseline record.",
  chamberSupportedBy: "Supported by",
  chamberWhy: "Why",
  chamberCollapse: "Collapse",
  chamberExpand: "Expand",
  chamberWhyConnected: "Why connected",
  chamberNoInterpretationYet: "Atlas has not yet formed a clear interpretation from this record.",
  chamberEvidence: "Evidence",
  chamberContribution: "Contribution",
  contributionHigh: "High",
  contributionModerate: "Moderate",
  contributionLight: "Light",
  chamberPatternInfluenced: "Pattern influenced",
  chamberAlso: "also",
  chamberNoSignalEvidenceYet: "Signal evidence will appear as patterns strengthen across observations.",
  chamberParticipantFacingLabel: "Participant-facing label",
  chamberSourceSnippet: "Source snippet",
  chamberRelatedPattern: "Related pattern",
  chamberBriefingInfluence: "Briefing influence",
  chamberNoLearningChainsYet: "Learning chains will appear as Atlas connects observations to patterns.",
  chamberRecordWillPopulate: "Your Atlas Record will populate as observations are captured.",

  evidenceStrengthCaption: "Evidence strength",

  confidenceConfirmed: "Confirmed",
  confidenceStrong: "Strong",
  confidenceEmerging: "Emerging",
  confidenceEarly: "Early",
  confidenceBaseline: "Baseline",
  watchStatusWatching: "Watching",
  watchStatusStable: "Stable",
  watchStatusEmerging: "Emerging",
  watchStatusBaseline: "Baseline",

  // The always-shown headline atop the Observation tab (separate from the AI
  // prose paragraphs below it, and separate from the deterministic
  // `narrative` fallback used only when no AI prose exists — that fallback
  // is a compositional multi-sentence template, deferred for now).
  headlineNoBaseline: "A respectful baseline from your first observation",
  headlineNarrativeThemes: "Your story weaves symptoms with lived meaning",
  headlineShapesRecord: "shapes this first record",

  // Generic error copy reused across more than one screen.
  errorSomethingWentWrong: "Something went wrong.",

  // Atlas Check-In (check-in/page.tsx) — the recurring companion-guided
  // check-in flow: loading/empty states, the tracked-signals summary, the
  // chat, and the Observatory Briefing confirmation screen.
  checkinLoadingSignals: "Loading your tracked signals…",
  checkinNoRecordTitle: "No Atlas Record yet",
  checkinNoRecordBody:
    "A check-in updates the signals from your most recent Atlas Record. Complete your first observation to begin your journey.",
  checkinHeaderBody: "Your companion will walk through what has changed since your last observation on",
  checkinTrackedSignalsTitle: "Previously Tracked Signals",
  checkinNoTrackedSignals:
    "No strong signals were tracked in your last record — your companion will ask about anything new.",
  checkinIntensitySuffix: "Intensity",
  checkinUrgentMarker: "Urgent symptom marker",
  checkinObservedBecausePrefix: "Observed because:",
  checkinCompanionThinking: "Companion is thinking…",
  checkinListeningPlaceholder: "Listening… tap the square to finish.",
  checkinSharePlaceholder: "Share how you've been feeling…",
  checkinStopRecordingAria: "Stop recording",
  checkinRecordAnswerAria: "Record a voice answer",
  checkinSendAria: "Send",
  checkinSkipAheadReview: "Skip ahead to review →",
  checkinBriefingTitle: "How Atlas understood your check-in",
  checkinBriefingBody:
    "Here's what your companion heard for each signal. If something doesn't feel right, head back to the conversation to talk it through before Atlas regenerates your record.",
  checkinUrgentBadge: "Urgent",
  checkinInResponseToPrefix: "In response to:",
  checkinMappedAsLabel: "Atlas mapped this as",
  checkinChangeWorsened: "Worsened",
  checkinChangeNoChange: "No Change",
  checkinChangeImproved: "Improved",
  checkinChangeResolved: "Resolved",
  checkinNewDevelopmentsTitle: "New developments",
  checkinNotesPlaceholder: "Anything new your companion should note…",
  checkinBackToConversation: "← Back to conversation",
  checkinConfirmSubmit: "Confirm & Submit Check-In",
  checkinGeneratingRecord: "Generating new record…",
  checkinCompanionUnavailable: "Companion is unavailable right now.",
  checkinCouldNotSave: "Could not save your check-in.",
  checkinSavedButRecordFailed: "Your check-in saved, but the record could not be generated.",
  checkinMicBlocked: "Microphone access was blocked. You can type your answer instead.",
  checkinVoiceMessageFailed: "Voice message failed.",

  // Chat (ChatInterface.tsx) — Aminata's own chat screen and the sidebar
  // slide-out panel (ambient on every page, not just /chat).
  chatNewConversation: "New Conversation",
  chatUntitledConversation: "New conversation",
  chatCloseConversationsAria: "Close conversations",
  chatShowConversationsAria: "Show conversations",
  chatCompanionRole: "Midwife & Body Literacy Companion",
  chatEmptyGreeting: "Hello, I'm Aminata",
  chatEmptyIntro:
    "I'm your body literacy companion. I can help you understand your Atlas observations, explore your patterns, and learn about your body. What would you like to talk about?",
  chatSuggestion1: "What did Atlas observe in my record?",
  chatSuggestion2: "Help me understand my patterns",
  chatSuggestion3: "What should I keep observing?",
  chatRecordingPlaceholder: "Recording…",
  chatMessagePlaceholder: "Message Aminata...",
  chatDiscardRecordingTitle: "Discard recording",
  chatSendVoiceTitle: "Send voice message",
  chatStopRecordingTitle: "Stop recording",
  chatRecordVoiceTitle: "Record a voice message",
  chatRecordingBanner: "Recording — tap the stop button when you're done.",
  chatDisclaimer: "Aminata is an observational companion, not a medical advisor. Always consult your healthcare provider.",
  chatStopListening: "Stop",
  chatListen: "Listen",
  chatMicUnavailable: "Microphone unavailable or permission denied.",
  chatCouldNotPlayReply: "Couldn't play that reply aloud right now.",
  chatSomethingWentWrong: "I'm sorry, something went wrong. Please try again.",
  chatCouldNotConnect: "I'm sorry, I couldn't connect. Please try again.",

  // AudioPlayer.tsx — the voice-note player used by both Chat and Check-in.
  audioCouldNotLoad: "Couldn't load this voice clip",
  audioPlay: "Play",
  audioPause: "Pause",
  audioLoading: "Loading…",

  // Dashboard insight cards (DominantPatternCard, ArchetypeCard, TopSignalsCard,
  // SupportingPatternsCard, InsightCard) and their supporting chart components
  // (SignalSparklines, SignalEvolutionChart, TimelineEvents).
  dashboardCoreInsightBadge: "Core insight",
  dashboardOnceFirstRecord: "once your first Atlas Record is generated.",
  dashboardDominantPatternTitle: "Your Dominant Pattern",
  dashboardDominantPatternEmpty: "Your dominant pattern will appear here",
  dashboardKeyDomainsContributing: "Key domains contributing",
  dashboardAtlasCallsThis: "Atlas calls this",
  dashboardWhyAtlasObservedThis: "Why Atlas observed this →",
  dashboardArchetypeTitle: "Your Current Archetype",
  dashboardArchetypeEmpty: "Your archetype will appear here",
  dashboardStrengthsInAction: "Your strengths in action",
  dashboardShapedByPrefix: "Shaped by",
  dashboardObservedPatternSingular: "observed pattern",
  dashboardObservedPatternPlural: "observed patterns",
  dashboardViewWhatShaped: "View what shaped this →",
  dashboardConfidenceCaption: "Confidence",
  dashboardTopSignalsTitle: "Your Top Signals",
  dashboardViewAll: "View all",
  dashboardSignalsEmpty: "Your signals will appear here",
  dashboardSignalsDisclaimer: "Signals are drawn from your own observations and are not a diagnosis.",
  dashboardStatusPersistent: "Persistent",
  dashboardStatusNew: "New",
  dashboardObservationsSuffix: "observations",
  dashboardAppearedInPrefix: "Appeared in",
  dashboardAppearedInMiddle: "of",
  dashboardAppearedInSuffix: "records",
  dashboardSupportingPatternsTitle: "Supporting Patterns",
  dashboardSupportingPatternsIntro: "Patterns contributing to your experience.",
  dashboardSupportingPatternsEmpty: "Supporting patterns will appear here",
  dashboardSignalTrendsEmpty: "Your signal trends will appear here",
  dashboardJourneyEventsEmpty: "Your journey events will appear here after your first observation.",
  dashboardLivingConstellationTitle: "Your Living Constellation",
  dashboardBetaBadge: "BETA",
  dashboardPatternsAcrossKeyDomains: "Your patterns across key domains.",

  // Constellation (atlas-constellation-map.tsx, constellation-node-modal.tsx) —
  // the Records-page tap-node map and its shared "what Atlas observed" popup.
  constellationTapHint: "Tap a node to view the pattern Atlas observed in this record.",
  constellationOpenPopupAriaPrefix: "Open Atlas Intelligence popup for",
  constellationOpenPatternAriaPrefix: "Open observed pattern for",
  constellationConfidenceLightBaseline: "Light baseline",
  constellationPatternPrefix: "Pattern",
  constellationSectionObserved: "What Atlas observed",
  constellationSectionWhyConnected: "Why Atlas connected these experiences",
  constellationSectionWillObserve: "What Atlas will continue observing",
  constellationSectionNote: "Atlas Note",
  constellationSectionRelatedPatterns: "Related Patterns",
  constellationSectionSupportingObservations: "Supporting Observations",
  constellationClosePopupAria: "Close observed pattern",

  // ObservationWizard.tsx — the edit-mode chrome around an already-completed
  // first observation (outside the wizard's own UiStringsProvider, so these
  // read straight off `definition.ui` like the nav buttons do).
  wizardEditingSection: "Editing",
  wizardEditingFirstObservation: "Editing your first observation",
  wizardSectionWord: "Section",
  wizardOfWord: "of",
  wizardAlreadyRecordedBanner:
    "You've already recorded your first observation. Edit any section below, then continue to regenerate your Atlas Record.",
} as const;

/**
 * Translation-key slug for a section heading.
 *
 * Sections are free text shared across several screens ("Pain and Discomfort"),
 * so they are keyed on the heading itself rather than on a screen id.
 */
export function sectionSlug(section: string): string {
  return section
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type UiStringKey = keyof typeof UI_STRINGS;
export type UiStrings = Record<UiStringKey, string>;

export const UI_STRING_KEYS = Object.keys(UI_STRINGS) as UiStringKey[];

/** Translation-table key for a UI string, e.g. `UI.back`. */
export const UI_TRANSLATION_PREFIX = "UI.";

/** Resolve every UI string against a loaded translation map, English fallback. */
export function resolveUiStrings(t: Record<string, string>): UiStrings {
  return Object.fromEntries(
    UI_STRING_KEYS.map((key) => [key, t[`${UI_TRANSLATION_PREFIX}${key}`] ?? UI_STRINGS[key]]),
  ) as UiStrings;
}
