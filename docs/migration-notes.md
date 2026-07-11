# Challenges

## Plugins conflict

oh my opencode and dcp(context manager) make a cicrle:

![alt text](opencode-dcp-conflict.png)


## Clean up

devcontainers allow to avoid uninstalling by simply rebuilding clean state.

## OhMyOpencode

Has great plugins, but bloats context as crazy. It extends tools descriptions, confuses agents, and causes it go all the wrong paths.

## Model Failures

### Loops

Thinking the same thing over and over, and not doing anything. It is a common failure of the model.

Solution:
- Limit generation context.
- Configure repetition penalty

![alt text](image-3.png)

## Tweaks

As the model is often lazy the system requires a bit of pushes. Like make sure todos are done, or make sure to use skills. Or use correct filepaths.

I had to create a plugin, to fix some of the issues.

### Frequent tool failures

Model suffers following tools description.

![alt text](image.png)

### Quality

Sometimes agent does something weired and may forget about it. Needs self review.

![alt text](image-1.png)

Oh yeah that looks like ligit code to me:

![alt text](image-2.png)

Could not write a single test file for 10 hours.