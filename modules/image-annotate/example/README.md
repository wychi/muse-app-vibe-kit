# Minimal drop-in example

```bash
npm install @muse-app-vibe-kit/image-annotate
```

```html
<button id="markup">Mark up this photo</button>
<script type="module">
  import { openAnnotator } from "@muse-app-vibe-kit/image-annotate";
  import "@muse-app-vibe-kit/image-annotate/styles.css";

  document.getElementById("markup").addEventListener("click", () => {
    openAnnotator({
      image: document.getElementById("photo"),  // data URL | Blob | <img> all work
      onComplete: ({ dataBase64, strokes, skipped }) => {
        if (skipped) { console.log("user skipped"); return; }
        console.log(`annotated with ${strokes} strokes`);
        // show it:
        const img = document.createElement("img");
        img.src = `data:image/png;base64,${dataBase64}`;
        document.body.append(img);
        // or upload it:
        // await fetch("/api/photos", { method: "POST", body: dataBase64 });
      },
    });
  });
</script>
```

See `../RECIPE.md` for *why* each of these choices exists.
