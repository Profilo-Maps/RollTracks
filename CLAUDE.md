# Project Architecture & Rules
You are a senior developer helping me build a react native app that will serve as a route data gathering service and front end for contributing OSM data through the DataRanger Service. Base OSM data is structured through the Proximity graph network, a parquet populated with denormalized OSM and government data. 

**Spec Checking Strategy:** Before implementing a feature, check the specs folder for guidance.

**Uncertainty Strategy:** ALWAYS ask questions before writing code. These questions should be used to highlight design decisions that are ambiguously justified by logic or that are matters of taste.

**Plan Document Etiquette:** DO NOT use the superpowers:writing-plans skill, start implementing after a design is approved. After a feature is implemented, check the /docs folder for intermediate implementation docs and consolidate them to the readme.md.

## Critical Constraints
- Do NOT generate new specs or documentation; I provide hand authored specs. Update the readme for new features.
- Maintain strict type safety across all module boundaries. 