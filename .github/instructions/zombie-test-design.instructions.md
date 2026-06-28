---
name: zombie-test-design
description: "Use when: designing new tests or defining the sequence of test cases for a feature. This instruction enforces the ZOMBIES mnemonic for incremental TDD."
applyTo: "tests/*.py"
---

# ZOMBIES: Incremental Test Design

When starting a new feature or fixing a bug, use the ZOMBIES mnemonic to discover and prioritize your test cases. This ensures you build logic incrementally from the simplest case to the most complex.

## The Mnemonic

### **Z – Zero**
Test the "nothing" case first. What happens when inputs are empty, null, or the system is uninitialized?
- *Goal*: Define base behavior for empty states.
- *Examples*: Empty lists, null strings, zero count.

### **O – One**
Test the simplest valid "something" case. What happens with exactly one item?
- *Goal*: Verify the core logic without loops or complexity.
- *Examples*: A list with one element, a single character, a one-second timer.

### **M – Many (or More)**
Test the behavior with multiple items or more complex data sets.
- *Goal*: Force the implementation of iteration, accumulation, or state management.
- *Examples*: Two or more items, complex nested objects.

### **B – Boundary Behaviors**
Test the edges of valid and invalid input ranges.
- *Goal*: Verify the "seams" and limits of the logic.
- *Examples*: Minimum/maximum values, exact crossover points (e.g., exactly 18 for an age check), empty vs. non-empty transitions.

### **I – Interface Definition**
Design the API from the perspective of the caller.
- *Goal*: Ensure the method signature, argument types, and return values are intuitive.
- *Focus*: Usability over implementation details.

### **E – Exercise Exceptional Behavior**
Explicitly test the "unhappy paths."
- *Goal*: Verify graceful failure and error handling.
- *Examples*: Invalid inputs, resource exhaustion, connectivity failures.

### **S – Simple Scenarios, Simple Solutions**
Keep both the test and the implementation limited to the simplest implementation that satisfies the current test without generalizing for future cases, such as using hardcoded values initially.
- *Goal*: Avoid over-engineering. If the "Zero" and "One" cases only need a hardcoded return, do it. Only generalize when "Many" or "Boundary" cases demand it.

## Applying ZOMBIES with the Iron Law
Start with **Zero** and proceed through the mnemonic in order. If a specific case demands it, you may skip to the next step, but only after the empty/base behavior is defined.
1.  Identify the **Z** case.
2.  Write the **RED** test for it.
3.  Implement the **GREEN** solution (keep it **S**imple).
4.  **Refactor** and iterate to **O**, then **M**, and so on.
