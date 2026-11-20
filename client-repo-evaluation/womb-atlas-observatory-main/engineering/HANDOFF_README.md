# Womb Atlas Observatory

# Engineering Handoff

Version: 1.0
Last Updated: June 2026

---

# Welcome

Welcome to the Womb Atlas Observatory project.

This repository contains the MVP implementation of Womb Atlas, a longitudinal observational intelligence platform focused on women's reproductive health experiences.

The platform is currently in active MVP development.

This document serves as the starting point for all engineering contributors.

---

# Project Purpose

Womb Atlas is designed to help participants:

* Document lived experiences
* Observe patterns
* Build body literacy
* Track change over time

The platform is not intended to diagnose conditions.

Its purpose is observational intelligence.

---

# Current MVP Scope

The current MVP includes:

## Participant Layer

* Authentication
* First Observation
* Reflection Summary
* Reflection Chamber
* Atlas Record
* Save Record Flow
* Participant Dashboard Scaffold

## Intelligence Layer

* Signal Extraction
* Pattern Detection
* Meaning Registry
* Body Literacy Library
* Reflection Composition

## Platform Foundations

* Google Cloud Infrastructure
* PostgreSQL Database
* Storage Layer
* Role Foundations

---

# Current Development Focus

Primary engineering focus:

1. Reflection Chamber Intelligence
2. Atlas Intelligence Architecture
3. Archetype Layer
4. Signal Landscapes
5. Atlas Timeline
6. Atlas Check-In

Do not prioritize visual redesign unless specifically requested.

The primary challenge is intelligence-layer refinement.

---

# Required Reading Order

Before making changes, review the following documents in order:

1. BUILD_STATUS.md
2. NEXT_PRIORITIES.md
3. ARCHITECTURE_OVERVIEW.md
4. AI_STACK_IMPLEMENTATION.md

Then review:

5. Master Screen Register
6. Atlas AI Stack Workbook
7. Figma Designs

---

# Source of Truth

## Product Logic

/specifications

Key files:

* Master Screen Register
* Atlas AI Stack Workbook
* Observatory MVP Build Specification

## Design

/figma

Primary source:

Figma Workspace

## Intelligence Architecture

AI_STACK_IMPLEMENTATION.md

This document defines:

* Signals
* Patterns
* Meanings
* Body Literacy
* Reflection Composition

---

# Platform Principles

All implementation decisions should follow:

1. Observation before diagnosis

2. Pattern before condition

3. Reflection before recommendation

4. Longitudinal before cross-sectional

5. Education before interpretation

6. Explainability over black-box outputs

Atlas should never function as a diagnostic engine.

---

# Current Architecture

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

---

# Repository Structure

```text
assets/
build/
database/
docs/
engineering/
figma/
logic/
specifications/
```

Engineering documentation is located in:

```text
engineering/
```

Specifications are located in:

```text
specifications/
```

---

# Access Requirements

Access should already be provisioned for:

* GitHub
* Figma
* Google Cloud
* Cursor

If access is missing, contact the project owner.

---

# Immediate Priorities

Short-term priorities:

* Improve Reflection Chamber intelligence
* Reduce answer repetition in reflections
* Implement dominant pattern hierarchy
* Implement archetype layer
* Implement signal landscapes
* Prepare Atlas Timeline

---

# Success Criteria

The MVP is considered successful when:

* Participants can complete First Observation
* Atlas generates meaningful reflections
* Atlas Records are created and saved
* Timeline foundations exist
* Check-In foundations exist
* Steward and Admin scaffolds exist
* Seed Intelligence foundations exist

---

# Questions

When uncertain:

1. Follow the Master Screen Register.
2. Follow the Atlas AI Stack Workbook.
3. Follow the Architecture Overview.
4. Preserve non-diagnostic behavior.

These documents are the current source of truth.

---

End of Document
