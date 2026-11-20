# Womb Atlas Observatory

# AI Stack Implementation Guide

Version: 1.0
Status: Active Architecture Document
Last Updated: June 2026

---

# Purpose

This document defines the Atlas Intelligence architecture that powers reflection generation, pattern detection, body literacy, and future longitudinal intelligence.

The AI Stack is not intended to diagnose conditions.

Its purpose is to organize participant experiences into meaningful observations, patterns, and educational reflections while preserving a non-diagnostic posture.

---

# Design Philosophy

Atlas is not a symptom tracker.

Atlas is an observational intelligence platform.

The objective is not to predict disease.

The objective is to help participants:

* Understand what Atlas noticed
* Understand what appears connected
* Understand why those connections may matter
* Build body literacy
* Observe changes over time

---

# Intelligence Pipeline

The Atlas Intelligence pipeline follows:

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

↓

Timeline Intelligence

---

# Layer 1

# Structured Signal Extraction

Purpose:

Convert questionnaire responses into standardized Atlas Signals.

Examples:

Heavy Bleeding

Pain During Intimacy

Fatigue

Dizziness

Cycle Irregularity

Care Delay

Work Impact

Signal Registry Source:

Master Screen Register

Signal Registry

Output:

Structured signal objects.

Example:

{
signal: "Heavy Bleeding",
source: "Questionnaire",
confidence: internal
}

Participant-facing confidence values are never displayed.

---

# Layer 2

# Narrative Signal Extraction

Purpose:

Extract experience themes from participant narrative responses.

This layer should eventually be AI-assisted.

Examples:

Unpredictability

Vigilance

Dismissal

Adaptation

Isolation

Frustration

Planning Burden

Loss of Control

Body Uncertainty

Current MVP:

Rule-based extraction.

Future:

LLM-assisted interpretation.

Output:

Narrative Signal Objects.

Example:

{
theme: "Unpredictability",
source: "Narrative"
}

---

# Layer 3

# Pattern Registry

Purpose:

Group related signals into meaningful patterns.

Patterns are the primary organizational unit within Atlas.

Patterns are not diagnoses.

Examples:

Bleeding Burden

Pain Spread

Hormonal Rhythm

Life Reorganization

Care Friction

Body Uncertainty

Pelvic Pressure

Pattern Registry Source:

15_Pattern_Registry

Output:

Detected Patterns.

Example:

{
pattern: "Bleeding Burden"
}

---

# Layer 4

# Meaning Registry

Purpose:

Explain why a detected pattern may matter.

The Meaning Layer transforms observations into understanding.

Examples:

Pattern:

Bleeding Burden

Meaning:

The impact of bleeding may extend beyond the cycle itself into planning, energy, movement, confidence, and daily routines.

Pattern:

Life Reorganization

Meaning:

A body pattern becomes increasingly important when it begins reorganizing daily life.

Source:

17_Meaning_Registry

Output:

Participant-friendly interpretation.

---

# Layer 5

# Body Literacy Library

Purpose:

Provide educational context.

Body Literacy content should:

* educate
* normalize
* inform

without diagnosing.

Examples:

Many people think bleeding is only important because of volume.

However, the effect bleeding has on energy, movement, planning, and confidence can also be meaningful.

Source:

18_Body_Literacy_Library

Output:

Atlas Notes

Educational Insights

---

# Layer 6

# Reflection Composition Engine

Purpose:

Generate personalized reflections.

Reflections should never simply repeat questionnaire answers.

Bad Example:

You reported pelvic pain and fatigue.

Good Example:

Atlas observed a pattern in which discomfort appears across multiple aspects of daily life. The impact of these experiences may extend beyond symptoms themselves and into routine, planning, and body awareness.

Source:

19_Reflection_Composition

Output:

Reflection Summary

Reflection Chamber

Atlas Record Reflection

---

# Dominant Pattern Logic

Patterns should not be treated equally.

Atlas should classify:

Dominant Pattern

Supporting Patterns

Context Patterns

Example:

Dominant Pattern

Bleeding Burden

Supporting Patterns

Life Reorganization

Body Uncertainty

Context Patterns

Care Friction

Hormonal Rhythm

The Dominant Pattern should anchor the Reflection Chamber.

---

# Archetype Layer

Status: Planned

Purpose:

Group multiple patterns into participant-centered narratives.

Examples:

The Adapting Navigator

The Bleeding Burden Experience

The Multi-System Experience

The Uncertain Body Experience

Archetypes help participants understand broader themes.

Archetypes are not diagnoses.

---

# Signal Landscapes

Status: Planned

Purpose:

Organize multiple patterns into broader observational landscapes.

Examples:

Bleeding Burden Landscape

Pain-Spread Landscape

Hormonal Rhythm Landscape

Care Friction Landscape

Body Uncertainty Landscape

Signal Landscapes allow Atlas to discuss complex experiences without making condition claims.

---

# Condition Signal Library

Status: Internal Only

Purpose:

Support research and future intelligence development.

This layer must never provide diagnostic output to participants.

Example:

Internal:

Pain Spread

*

Pain During Intimacy

*

Cycle-linked Pain

*

Bowel Symptoms

Participant Output:

Atlas observed a pain-spread landscape involving multiple body functions.

Not:

Atlas thinks you have endometriosis.

---

# Reflection Chamber Structure

The Reflection Chamber should answer:

1. What did Atlas notice?

2. What appears connected?

3. Why might that matter?

4. What can I learn from it?

5. What should I continue observing?

Recommended structure:

Your Reflection

↓

Observation Portrait

↓

Dominant Pattern

↓

Supporting Patterns

↓

Pattern Connections

↓

Narrative Themes

↓

Body Literacy

↓

Signal Landscapes

↓

Archetype

↓

What Atlas Will Watch

---

# What Atlas Never Does

Atlas does not:

* Diagnose
* Predict disease
* Assign risk scores
* Assign probability scores
* Display confidence percentages
* Rank conditions

Atlas instead:

* Observes
* Organizes
* Connects
* Educates
* Reflects
* Tracks change over time

---

# Reuse Across Platform

The Atlas Intelligence Stack must be reusable across:

* First Observation
* Atlas Check-In
* Atlas Timeline
* Reflection Chamber
* Atlas Record
* Steward Layer
* Reviewer Layer
* Seed Intelligence Layer

The AI Stack is a platform capability.

It is not a Reflection Chamber feature.

---

# Future Evolution

Phase 1

Rule-Based Intelligence

Current MVP

Phase 2

Narrative AI

Theme extraction

Reflection generation

Phase 3

Longitudinal Intelligence

Pattern evolution

Trajectory analysis

Change detection

Phase 4

Population Intelligence

Seed Intelligence Layer

Signal distribution

Pattern distribution

Observation landscapes

---

End of Document
