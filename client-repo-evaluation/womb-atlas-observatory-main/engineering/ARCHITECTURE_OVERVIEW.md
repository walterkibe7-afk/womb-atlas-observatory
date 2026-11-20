# Womb Atlas Observatory

# Architecture Overview

Version: 1.0
Status: Active Architecture Document
Last Updated: June 2026

---

# Purpose

This document provides a high-level overview of the Womb Atlas Observatory platform architecture.

Its purpose is to help engineers, designers, product contributors, and future team members understand how the platform is structured and how individual components work together.

This document should be read before reviewing implementation details.

---

# Vision

Womb Atlas is a longitudinal observational intelligence platform designed to help women document, understand, and observe their reproductive health experiences over time.

The platform is not intended to diagnose medical conditions.

Its purpose is to:

* Capture lived experiences
* Identify patterns
* Build body literacy
* Track change over time
* Generate population-level observational intelligence

---

# Core Platform Philosophy

Traditional health systems organize around conditions.

Atlas organizes around observations.

Traditional systems ask:

"What condition does this person have?"

Atlas asks:

"What experiences are emerging, changing, connecting, or persisting over time?"

---

# Platform Overview

The platform consists of seven major layers.

```text
Participant
    ↓
First Observation
    ↓
Atlas Intelligence
    ↓
Atlas Record
    ↓
Atlas Timeline
    ↓
Atlas Check-In
    ↓
Observatory Layers
```

---

# Layer 1

# First Observation

Purpose:

Capture a participant's baseline experience.

The First Observation is the primary intake experience.

It combines:

* Structured questions
* Narrative responses
* Context information
* Care experiences
* Functional impacts

Outputs:

* Signals
* Patterns
* Reflection
* Atlas Record

Key Documents:

* Master Screen Register
* Atlas AI Stack Workbook

---

# Layer 2

# Atlas Intelligence

Purpose:

Transform participant responses into meaningful observations.

Atlas Intelligence performs:

* Signal extraction
* Pattern detection
* Narrative interpretation
* Meaning generation
* Body literacy generation
* Reflection composition

Outputs:

* Reflection Summary
* Reflection Chamber
* Atlas Record

Key Document:

AI_STACK_IMPLEMENTATION.md

---

# Layer 3

# Atlas Record

Purpose:

Create a permanent observational snapshot.

The Atlas Record serves as:

* participant baseline
* reflection archive
* timeline anchor

The Atlas Record contains:

* Observation Portrait
* Dominant Pattern
* Supporting Patterns
* Narrative Themes
* Reflection
* Body Literacy
* Future Observation Areas

The Atlas Record is not a diagnosis.

---

# Layer 4

# Atlas Timeline

Purpose:

Track observations across time.

Timeline capabilities:

* Observation history
* Pattern evolution
* Emerging patterns
* Stable patterns
* Reflection archive

Timeline transforms isolated observations into longitudinal intelligence.

---

# Layer 5

# Atlas Check-In

Purpose:

Provide lightweight follow-up observations.

Participants should not need to repeat the full observation each time.

Check-ins capture:

* symptom changes
* new experiences
* pattern changes
* life impacts

Outputs:

* timeline updates
* trajectory updates
* pattern evolution

---

# Layer 6

# Participant Observatory

Purpose:

Provide participant access to personal intelligence.

Capabilities:

* Atlas Records
* Reflection history
* Timeline
* Check-ins
* Observation management

The Participant Observatory is the participant-facing home of Atlas.

---

# Layer 7

# Steward Layer

Purpose:

Support observation review and stewardship.

Capabilities:

* Observation review
* Steward notes
* Participant support
* Pattern monitoring

Stewards do not diagnose.

Stewards help preserve observation quality and participant engagement.

---

# Layer 8

# Administration Layer

Purpose:

Platform administration and governance.

Capabilities:

* User management
* Role management
* Observation administration
* Audit monitoring
* Platform controls

---

# Layer 9

# Seed Intelligence Layer

Purpose:

Generate aggregated observational intelligence.

This layer operates on de-identified participant observations.

Capabilities:

* Pattern distribution
* Signal distribution
* Language analysis
* Geography analysis
* Population-level observation trends

Outputs:

* Intelligence dashboards
* Observation reports
* Research insights

---

# User Journey

```text
Participant
    ↓
First Observation
    ↓
Reflection Summary
    ↓
Reflection Chamber
    ↓
Atlas Record
    ↓
Save Atlas Record
    ↓
Participant Observatory
    ↓
Timeline
    ↓
Check-Ins
    ↓
Additional Atlas Records
```

---

# Intelligence Flow

```text
Questionnaire Responses
    ↓
Structured Signals
    ↓
Narrative Signals
    ↓
Observed Patterns
    ↓
Meanings
    ↓
Body Literacy
    ↓
Reflection Composition
    ↓
Atlas Record
```

The Intelligence Flow is implemented through the Atlas Intelligence Stack.

---

# Technical Architecture

Current stack:

Frontend:

* Next.js
* React
* TypeScript

Backend:

* Node.js

Database:

* PostgreSQL
* Google Cloud SQL

Storage:

* Google Cloud Storage

Authentication:

* Google OAuth

Hosting:

* Google Cloud Platform

Services:

* Cloud Run
* Cloud Storage
* Cloud SQL

---

# Design System

Source of Truth:

Figma

Key design principles:

* Aubergine background
* Bronze accents
* Atmospheric grain
* Constellation metaphor
* Card-based interfaces
* Low-clinical visual language

Atlas should feel reflective rather than medical.

---

# Architectural Principles

All future development should follow:

1. Observation before diagnosis

2. Pattern before condition

3. Reflection before recommendation

4. Longitudinal before cross-sectional

5. Education before interpretation

6. Participant ownership of experience

7. Explainability over black-box outputs

---

# Current Development Priorities

1. Reflection Chamber Intelligence

2. Archetype Layer

3. Signal Landscapes

4. Atlas Timeline

5. Atlas Check-In

6. Steward Layer

7. Administration Layer

8. Seed Intelligence Layer

---

# Recommended Reading Order

For new engineers:

1. HANDOFF_README.md

2. BUILD_STATUS.md

3. NEXT_PRIORITIES.md

4. ARCHITECTURE_OVERVIEW.md

5. AI_STACK_IMPLEMENTATION.md

6. Master Screen Register

7. Atlas AI Stack Workbook

Only after understanding these documents should implementation begin.

---

End of Document
