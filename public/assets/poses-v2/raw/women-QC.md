# Female guest reactions generation record

Generated with built-in image_gen on 2026-09-20 from existing body-9.png through body-16.png references. These are newly drawn whole headless bodies with real changed arm, hand, leg and garment poses; no reference body part was cut, rotated or reassembled.

Six raw image files and the exact hand-written prompts are in this directory:

- women-8-11-wave.png / women-8-11-wave.prompt.txt
- women-8-11-dance.png / women-8-11-dance.prompt.txt
- women-8-11-clap.png / women-8-11-clap.prompt.txt
- women-12-15-wave.png / women-12-15-wave.prompt.txt
- women-12-15-dance.png / women-12-15-dance.prompt.txt
- women-12-15-clap.png / women-12-15-clap.prompt.txt

Each sheet has a 4 by 4 layout. Four successive phases for each outfit occupy one 2 by 2 quadrant. Zero-based grid indices are [0,1,4,5], [2,3,6,7], [8,9,12,13], [10,11,14,15]. They correspond to the four consecutive outfit indices in the filename.

Processor outputs are at ../processed/<filename-without-extension>/. Frames use one-based custom_grid-1.png through custom_grid-16.png. Each output sheet uses a single shared scale and feet alignment. No per-frame independent resizing or body reconstruction was performed. The processor used rows=4, cols=4, cell-size=320, fit-scale=0.82, align=feet, shared-scale, component-mode=largest, reject-edge-touch. Raw generated images remain available for a final project-specific neck/feet anchor pass.

All six raw sheets and all six processed transparent sheets were visually inspected. All 96 bodies are present; all eight outfit identities are preserved; each action has four distinct phases. Waving changes elbow/wrist/palm shape. Dancing has left/right steps and newly drawn arms, legs and cloth folds. Clapping has hands apart, closer, touching, reopened. No heads, eyes, hair, floating props, missing garments or cropped feet were found. The tool returned alpha backgrounds with colored edge debris despite the requested solid magenta background; deterministic cleanup removed that debris. All 96 processor frames passed edge-touch checks.

Final 128 by 128 avatar atlas placement is intentionally left to the root integration pass, which shares the anchor policy with the male reaction and directional sheets.
