interface HelpTopic {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly keywords?: readonly string[]
}
interface HelpBook {
  readonly id: string
  readonly title: string
  readonly contents: readonly (
    | HelpTopic
    | { readonly title: string; readonly topics: readonly HelpTopic[] }
  )[]
}

const topic = (id: string, title: string, body: string, keywords?: readonly string[]): HelpTopic => ({
  id,
  title,
  body,
  ...(keywords ? { keywords } : {}),
})

export const help: HelpBook = {
  id: 'paint',
  title: 'Paint Help',
  contents: [
    topic(
      'paint-overview',
      'Paint at a glance',
      `Paint draws and edits pictures saved as bitmap (.bmp) files. Pick a tool in the **tool box** on the left, pick colors in the **color box** at the bottom, and drag on the picture.

Hold the left mouse button to draw with the foreground color. Hold the right button to draw with the background color.

The status bar shows help for the tool or command under the pointer, the pointer position in pixels, and the size of a shape or selection while you drag it.

See [Drawing lines and shapes](paint-shapes) and [Working with selections](paint-select) to get started.`,
      ['overview', 'tool box', 'color box', 'status bar'],
    ),
    {
      title: 'Drawing',
      topics: [
        topic(
          'paint-freehand',
          'Drawing freehand',
          `**Pencil** draws a line one pixel wide. **Brush** draws with the shape and size you choose in the box under the tools. **Airbrush** sprays dots while you hold the button; choose one of three spray sizes.

**Eraser** paints with the background color. Drag with the right button to use it as a **Color Eraser**, which changes only pixels of the foreground color to the background color.`,
          ['pencil', 'brush', 'airbrush', 'eraser', 'color eraser'],
        ),
        topic(
          'paint-shapes',
          'Drawing lines and shapes',
          `Pick **Line**, then drag from one end to the other. Choose a line width from the box under the tools. Hold SHIFT to keep the line horizontal, vertical, or at 45 degrees.

**Rectangle**, **Ellipse**, and **Rounded Rectangle** draw from corner to corner. The box under the tools offers three fill styles: outline only, an outline filled with the background color, and a solid shape. Hold SHIFT to draw a square or a circle.

For curves and polygons, see [Drawing curves](paint-curve) and [Drawing polygons](paint-polygon).`,
          ['line', 'rectangle', 'ellipse', 'rounded rectangle', 'fill style', 'square', 'circle'],
        ),
        topic(
          'paint-curve',
          'Drawing curves',
          `1. Click **Curve** and choose a line width.
2. Drag to draw a straight line between the two ends of the curve.
3. Click or drag where you want the first bend. The line bends toward the pointer.
4. Click or drag again for a second bend. The curve is finished after the second bend.

To finish with one bend, click the second time at the same place as the first. Press ESC or click the other mouse button to cancel the curve.`,
          ['curve', 'bend', 'bezier'],
        ),
        topic(
          'paint-polygon',
          'Drawing polygons',
          `1. Click **Polygon** and choose a fill style.
2. Drag to draw the first side.
3. Click at each further corner. Paint draws a side to each one.
4. Double-click at the last corner, or click on the first corner, to close the polygon.`,
          ['polygon', 'corner'],
        ),
        topic(
          'paint-fill',
          'Filling and picking colors',
          `**Fill With Color** paints the whole area of one color around the point you click. A gap in an outline lets the color run out.

**Pick Color** takes the color under the pointer. Click to make it the foreground color, or right-click for the background color. Paint then returns to the tool you used before.`,
          ['fill', 'pick color', 'eyedropper'],
        ),
        topic(
          'paint-text',
          'Adding text',
          `1. Click **Text**, then drag a frame where the text should go.
2. Type. The text wraps inside the frame, and the frame grows downward as you type.
3. Choose the font, size, bold, italic, and underline in the **Fonts** toolbar. If the toolbar is hidden, click **Text Toolbar** on the View menu.
4. Click outside the frame to place the text in the picture.

The box under the tools chooses whether the text has an opaque background in the background color or a transparent one.`,
          ['text', 'font', 'fonts toolbar', 'bold', 'italic', 'underline'],
        ),
      ],
    },
    {
      title: 'Editing',
      topics: [
        topic(
          'paint-select',
          'Working with selections',
          `**Select** marks a rectangle, and **Free-Form Select** marks any shape you trace. Drag inside a selection to move it. The area it leaves behind takes the background color.

Hold CTRL while you drag to move a copy and leave the original. Hold SHIFT while you drag to smear copies along the way.

In the box under the tools, the top choice moves the selection with its background. The bottom choice makes pixels of the background color see-through. **Draw Opaque** on the Options menu switches between them.

Click outside the selection to drop it into the picture.`,
          ['select', 'free-form select', 'move', 'transparent', 'opaque', 'smear'],
        ),
        topic(
          'paint-clipboard',
          'Cutting, copying, and pasting',
          `**Cut** (CTRL+X) and **Copy** (CTRL+C) put the selection on the Clipboard. **Paste** (CTRL+V) places the Clipboard contents at the top left of the view as a new selection you can drag into place. If the pasted picture is larger than yours, Paint offers to enlarge the picture.

**Clear Selection** (DEL) fills the selection with the background color. **Select All** (CTRL+A) selects the whole picture.

**Copy To** saves the selection as its own bitmap file, and **Paste From** brings a bitmap file in as a selection.`,
          ['cut', 'copy', 'paste', 'clipboard', 'clear selection', 'select all', 'copy to', 'paste from'],
        ),
        topic(
          'paint-undo',
          'Undoing changes',
          `**Undo** (CTRL+Z) reverses your last change. Paint remembers your last three changes. **Repeat** (CTRL+Y) puts back a change you undid.`,
          ['undo', 'repeat'],
        ),
      ],
    },
    {
      title: 'Changing the picture',
      topics: [
        topic(
          'paint-image',
          'Flipping, rotating, stretching, and skewing',
          `The Image menu works on the selection when there is one, and on the whole picture otherwise.

**Flip/Rotate** flips the picture horizontally or vertically, or rotates it by 90, 180, or 270 degrees.

**Stretch/Skew** stretches each direction by a percentage from 1 to 500, and slants it by an angle from -89 to 89 degrees.

**Invert Colors** replaces each color with its opposite. **Clear Image** fills the picture with the background color.`,
          ['flip', 'rotate', 'stretch', 'skew', 'invert', 'clear image'],
        ),
        topic(
          'paint-attributes',
          'Changing the picture size',
          `Click **Attributes** on the Image menu. Type the width and height in inches, centimeters, or pels (pixels). **Default** restores the size of a new picture.

Choose **Black and white** to turn the picture into two colors.`,
          ['attributes', 'size', 'width', 'height', 'pels', 'black and white'],
        ),
        topic(
          'paint-colors',
          'Changing the color box',
          `Double-click a color in the color box, or click **Edit Colors** on the Options menu, to replace it. Choose a basic color, or click **Define Custom Colors** to mix your own by hue, saturation, and luminosity or by red, green, and blue.

**Save Colors** writes the color box to a palette (.pal) file, and **Get Colors** loads one.`,
          ['edit colors', 'custom colors', 'palette', 'get colors', 'save colors'],
        ),
      ],
    },
    {
      title: 'Viewing',
      topics: [
        topic(
          'paint-zoom',
          'Zooming in',
          `Click **Magnifier** and then the part of the picture to enlarge, or choose a magnification in the box under the tools. **Zoom** on the View menu offers **Normal Size** (CTRL+PAGE UP), **Large Size** (CTRL+PAGE DOWN), and **Custom** sizes up to 800 percent.

When the picture is enlarged to 400 percent or more, **Show Grid** draws a line between pixels. **Show Thumbnail** opens a small window with the zoomed area at its normal size.

**View Bitmap** (CTRL+F) shows the picture on the whole screen. Click or press any key to return.`,
          ['zoom', 'magnifier', 'grid', 'thumbnail', 'view bitmap'],
        ),
        topic(
          'paint-files',
          'Opening and saving pictures',
          `Paint opens and saves bitmap files (.bmp and .dib). Save As offers monochrome, 16-color, 256-color, and 24-bit bitmaps. A picture saved with fewer colors keeps only the colors that type can hold.

The File menu lists the last four pictures you opened or saved.`,
          ['open', 'save', 'bitmap', 'bmp', 'dib', 'recent'],
        ),
      ],
    },
  ],
}
