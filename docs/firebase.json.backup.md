Backup of firebase.json at time of export rewrite standardization.

```
{
  "firestore": { "rules": "firestore.rules" },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/lists/**", "function": "listsExport" }
    ]
  },
  "functions": { "source": "functions" }
}
```
