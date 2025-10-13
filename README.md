Zephyr: Autonomous ASCII Overlay
Overview
Zephyr is an autonomous ASCII‑styled game overlay designed for OBS or any browser source.
It is built entirely in HTML and JavaScript, with all logic exposed in a configuration block at the top of the file.
The project is meant to be modified, remixed, and extended. Everything is organized for clarity and reference.
Core Features
• 	Autonomous gameplay that runs without manual input
• 	Config‑driven structure: all settings are editable at the top of the file
• 	ASCII graphics for a lightweight, transparent overlay
• 	No Entry Zone (NEZ) to protect the central OBS layout area
• 	Health decay and pickups to create a survival loop
• 	Live chat integration through an API endpoint
• 	Seed system for procedural variation across sessions
Game Loop
1. 	Initialize overlay with configuration and seed
2. 	Spawn pickups, apply health decay, and enforce the NEZ
3. 	Pull live chat and display squad commentary
4. 	Watcher routines trigger events and rituals
5. 	Loop continues until reset or a new seed is applied
Seed System
The seed determines procedural variation. It can be based on a timestamp or a custom string.
It influences pickup spawn patterns, health decay modifiers, and event triggers.
Configuration
At the top of the HTML/JS file you will find a configuration block.
This is where you set values such as seed, NEZ dimensions, health decay rate, pickup intervals, and the live chat API.
Replace the placeholder  with your actual chat API URL.
How to Modify
• 	Open the HTML file in any editor
• 	Adjust values in the configuration block
• 	Save and reload in OBS or a browser source
• 	Each module is isolated and documented for easy remixing
Philosophy
This project is built as a modular archive.
Every mechanic is separated into its own module, with explicit and referenceable code.
It is designed for clarity, resilience, and creative autonomy.
