tool: fetch
url: https://raw.githubusercontent.com/AutomaApp/documentation/main/docs/workflow/global-data.md
date: 2026-08-11
source: fetch

Content type text/plain; charset=utf-8 cannot be simplified to markdown, but here is the raw content:
Contents of https://raw.githubusercontent.com/AutomaApp/documentation/main/docs/workflow/global-data.md:
---
title: Global Data
---

# Global Data

Use global data to define a global variable within your workflow.
For example, you have multiple new tab blocks wherein the URL input has the same domain e.g. "http://dribbble.com". Instead of editing the block one by one to change the URL domain, you can define the URL domain in the global data like:

```json
{
  "url": "https://dribbble.com"
}
```
And access the global data inside the URL text field of the New Tab block using an [expression](./expressions.md). For example, <code v-pre>{{globalData.url}}</code>

![URL Input](https://s3.ap-southeast-1.amazonaws.com/automa-pub/i/2024/12/02/16bhla-4b.png)
