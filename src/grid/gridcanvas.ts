/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
import {
  Message, sendMessage
} from '../core/messaging';

import {
  ISignal
} from '../core/signaling';

import {
  ResizeMessage, Widget, WidgetFlag, WidgetMessage
} from '../ui/widget';

import {
  ICellConfig, ICellRenderer, SimpleCellRenderer
} from './cellrenderer';

import {
  DataModel
} from './datamodel';

import {
  GridHeader
} from './gridheader';


/**
 * The class name added to grid canvas instance.
 */
const GRID_CANVAS_CLASS = 'p-GridCanvas';

/**
 * The class name added to the canvas node of a grid canvas.
 */
const CANVAS_CLASS = 'p-GridCanvas-canvas';


/**
 * A widget which renders the cells of a grid.
 *
 * #### Notes
 * User code will not normally interact with this class directly.
 *
 * The `DataGrid` class uses an instance of the class internally.
 *
 * This class is not designed to be subclassed.
 */
export
class GridCanvas extends Widget {
  /**
   * Construct a new grid canvas.
   *
   * @param options - The options for initializing the canvas.
   */
  constructor(options: GridCanvas.IOptions = {}) {
    super();
    this.addClass(GRID_CANVAS_CLASS);
    this.setFlag(WidgetFlag.DisallowLayout);

    // Create the default cell renderer.
    this._cellRenderers['default'] = new SimpleCellRenderer();

    // Create the off-screen rendering buffer.
    this._buffer = document.createElement('canvas');
    this._buffer.width = 0;
    this._buffer.height = 0;

    // Create the on-screen rendering canvas.
    this._canvas = document.createElement('canvas');
    this._canvas.className = CANVAS_CLASS;
    this._canvas.width = 0;
    this._canvas.height = 0;
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = '0px';
    this._canvas.style.left = '0px';
    this._canvas.style.width = '0px';
    this._canvas.style.height = '0px';

    // Attach the canvas to the widget node.
    this.node.appendChild(this._canvas);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this._model = null;
    this._buffer = null;
    this._canvas = null;
    this._rowHeader = null;
    this._columnHeader = null;
    this._cellRenderers = null;
    super.dispose();
  }

  /**
   * Get the data model rendered by the canvas.
   */
  get model(): DataModel {
    return this._model;
  }

  /**
   * Set the data model rendered by the canvas.
   */
  set model(value: DataModel) {
    // Null and undefined are treated the same.
    value = value || null;

    // Do nothing if the model does not change.
    if (this._model === value) {
      return;
    }

    // Disconnect the signal handlers from the old model.
    if (this._model) {
      // TODO
    }

    // Connect the signal handlers for the new model.
    if (value) {
      // TODO
    }

    // Update the internal model reference.
    this._model = value;

    // Schedule an update of the canvas.
    this.update();
  }

  /**
   * Get the row header for the canvas.
   */
  get rowHeader(): GridHeader {
    return this._rowHeader;
  }

  /**
   * Set the row header for the canvas.
   *
   * #### Notes
   * This is a "borrowed" reference to the header for the purposes of
   * sizing the row sections. The canvas does not become the parent
   * of the header.
   */
  set rowHeader(value: GridHeader) {
    // Null and undefined are treated the same.
    value = value || null;

    // Lookup the old header.
    let old = this._rowHeader;

    // Do nothing if the header does not change.
    if (old === value) {
      return;
    }

    // Disconnect the signal handlers from the old header.
    if (old) {
      old.sectionsResized.disconnect(this._onSectionsResized, this);
    }

    // Connect the signal handlers for the new header.
    if (value) {
      value.sectionsResized.connect(this._onSectionsResized, this);
    }

    // Update the internal header reference.
    this._rowHeader = value;

    // Schedule an update of the canvas.
    this.update();
  }

  /**
   * Get the column header for the canvas.
   */
  get columnHeader(): GridHeader {
    return this._columnHeader;
  }

  /**
   * Set the column header for the canvas.
   *
   * #### Notes
   * This is a "borrowed" reference to the header for the purposes of
   * sizing the column sections. The canvas does not become the parent
   * of the header.
   */
  set columnHeader(value: GridHeader) {
    // Null and undefined are treated the same.
    value = value || null;

    // Lookup the old header.
    let old = this._columnHeader;

    // Do nothing if the header does not change.
    if (old === value) {
      return;
    }

    // Disconnect the signal handlers from the old header.
    if (old) {
      old.sectionsResized.disconnect(this._onSectionsResized, this);
    }

    // Connect the signal handlers for the new header.
    if (value) {
      value.sectionsResized.connect(this._onSectionsResized, this);
    }

    // Update the internal header reference.
    this._columnHeader = value;

    // Schedule an update of the canvas.
    this.update();
  }

  /**
   * Get the scroll X offset of the canvas.
   */
  get scrollX(): number {
    return this._scrollX;
  }

  /**
   * Set the scroll X offset of the canvas.
   */
  set scrollX(value: number) {
    this.scrollTo(value, this._scrollY);
  }

  /**
   * Get the scroll Y offset of the canvas.
   */
  get scrollY(): number {
    return this._scrollY;
  }

  /**
   * Set the scroll Y offset of the canvas.
   */
  set scrollY(value: number) {
    this.scrollTo(this._scrollX, value);
  }

  /**
   * Scroll the canvas by the specified delta.
   *
   * @param dx - The scroll X delta, in pixels.
   *
   * @param dy - The scroll Y delta, in pixels.
   */
  scrollBy(dx: number, dy: number): void {
    this.scrollTo(this._scrollX + dx, this._scrollY + dy);
  }

  /**
   * Scroll to the specified offset position.
   *
   * @param x - The scroll X offset, in pixels.
   *
   * @param y - The scroll Y offset, in pixels.
   *
   * #### Notes
   * Negative values will be clamped to zero.
   *
   * Fractional values will be rounded to the nearest integer.
   *
   * The canvas can be scrolled beyond the bounds of the rendered grid
   * if desired. Practically, there is no limit to the scroll position.
   * Technically, the limit is `Number.MAX_SAFE_INTEGER`.
   */
  scrollTo(x: number, y: number): void {
    // Coerce the desired scroll position to integers `>= 0`.
    x = Math.max(0, Math.round(x));
    y = Math.max(0, Math.round(y));

    // Compute the delta scroll amount.
    let dx = x - this._scrollX;
    let dy = y - this._scrollY;

    // Bail early if there is no effective scroll.
    if (dx === 0 && dy === 0) {
      return;
    }

    // Update the internal scroll position.
    this._scrollX = x;
    this._scrollY = y;

    // Bail early if the widget is not visible.
    if (!this.isVisible) {
      return;
    }

    // Get the current size of the canvas.
    let width = this._canvas.width;
    let height = this._canvas.height;

    // Bail early if the canvas is empty.
    if (width === 0 || height === 0) {
      return;
    }

    // Paint everything if either delta is larger than the viewport.
    if (Math.abs(dx) >= width || Math.abs(dy) >= height) {
      this._paint(0, 0, width, height);
      return;
    }

    // Setup the image blit variables.
    let srcX = 0;
    let srcY = 0;
    let dstX = 0;
    let dstY = 0;
    let imgW = width;
    let imgH = height;

    // Setup the dirty margin variables.
    let top = 0;
    let left = 0;
    let right = 0;
    let bottom = 0;

    // Compute the values for any horizontal scroll.
    if (dx < 0) {
      left = -dx;
      dstX = left;
      imgW = width - left;
    } else if (dx > 0) {
      right = dx;
      srcX = right;
      imgW = width - right;
    }

    // Compute the values for any vertical scroll.
    if (dy < 0) {
      top = -dy;
      dstY = top;
      imgH = height - top;
    } else if (dy > 0) {
      bottom = dy;
      srcY = bottom;
      imgH = height - bottom;
    }

    // Get the graphics context for the canvas.
    let gc = this._canvas.getContext('2d');

    // Blit the valid image data to the new location.
    gc.drawImage(this._canvas, srcX, srcY, imgW, imgH, dstX, dstY, imgW, imgH);

    // Paint the dirty region at the left, if needed.
    if (left > 0) {
      this._paint(0, 0, left, height);
    }

    // Paint the dirty region at the right, if needed.
    if (right > 0) {
      this._paint(width - right, 0, right, height);
    }

    // Paint the dirty region at the top, if needed.
    if (top > 0) {
      this._paint(left, 0, width - left - right, top);
    }

    // Paint the dirty region at the bottom, if needed.
    if (bottom > 0) {
      this._paint(left, height - bottom, width - left - right, bottom);
    }
  }

  /**
   * Get the cell renderer assigned to a given name.
   *
   * @param name - The name of the cell renderer of interest.
   *
   * @returns The cell renderer for the given name, or `undefined`.
   */
  getCellRenderer(name: string): ICellRenderer {
    return this._cellRenderers[name];
  }

  /**
   * Set the cell renderer for a given name.
   *
   * @param name - The name of the cell renderer of interest.
   *
   * @param renderer - The cell renderer to assign to the name.
   *
   * #### Notes
   * The given renderer will override the previous renderer for the
   * specified name. If the renderer is `null` or `undefined`, the
   * previous renderer will be removed.
   */
  setCellRenderer(name: string, renderer: ICellRenderer): void {
    if (renderer) {
      this._cellRenderers[name] = renderer;
    } else {
      delete this._cellRenderers[name];
    }
    this.update();
  }

  /**
   * A message handler invoked on an `'after-show'` message.
   */
  protected onAfterShow(msg: Message): void {
    this.fit();
  }

  /**
   * A message handler invoked on an `'after-attach'` message.
   */
  protected onAfterAttach(msg: Message): void {
    this.fit();
  }

  /**
   * A message handler invoked on an `'update-request'` message.
   */
  protected onUpdateRequest(msg: Message): void {
    // Do nothing if the widget is not visible.
    if (!this.isVisible) {
      return;
    }

    // Get the visible size of the canvas.
    let width = this._canvas.width;
    let height = this._canvas.height;

    // Bail early if the canvas has zero area.
    if (width === 0 || height === 0) {
      return;
    }

    // Paint the entire canvas.
    this._paint(0, 0, width, height);
  }

  /**
   * A message handler invoked on a `'fit-request'` message.
   */
  protected onFitRequest(msg: Message): void {
    // Do nothing if the widget is not visible.
    if (!this.isVisible) {
      return;
    }

    // Measure the node size.
    let width = Math.round(this.node.offsetWidth);
    let height = Math.round(this.node.offsetHeight);

    // Resize the canvas and buffer to fit.
    this._buffer.width = width;
    this._buffer.height = height;
    this._canvas.width = width;
    this._canvas.height = height;
    this._canvas.style.width = `${width}px`;
    this._canvas.style.height = `${height}px`;

    // Repaint the canvas immediately.
    sendMessage(this, WidgetMessage.UpdateRequest);
  }

  /**
   * A message handler invoked on a `'resize'` message.
   */
  protected onResize(msg: ResizeMessage): void {
    // Bail early if the widget is not visible.
    if (!this.isVisible) {
      return;
    }

    // Unpack the message data.
    let { width, height } = msg;

    // Measure the node if the dimensions are unknown.
    if (width === -1) {
      width = this.node.offsetWidth;
    }
    if (height === -1) {
      height = this.node.offsetHeight;
    }

    // Round the dimensions to the nearest pixel.
    width = Math.round(width);
    height = Math.round(height);

    // Get the current size of the canvas.
    let oldWidth = this._canvas.width;
    let oldHeight = this._canvas.height;

    // Determine whether there is valid content to blit.
    let needBlit = oldWidth > 0 && oldHeight > 0 && width > 0 && height > 0;

    // Resize the off-screen buffer to the new size.
    this._buffer.width = width;
    this._buffer.height = height;

    // Blit the old contents into the buffer, if needed.
    if (needBlit) {
      let bufferGC = this._buffer.getContext('2d');
      bufferGC.drawImage(this._canvas, 0, 0);
    }

    // Resize the on-screen canvas to the new size.
    this._canvas.width = width;
    this._canvas.height = height;
    this._canvas.style.width = `${width}px`;
    this._canvas.style.height = `${height}px`;

    // Blit the buffer contents into the canvas, if needed.
    if (needBlit) {
      let canvasGC = this._canvas.getContext('2d');
      canvasGC.drawImage(this._buffer, 0, 0);
    }

    // Compute the sizes of the dirty regions.
    let right = Math.max(0, width - oldWidth);
    let bottom = Math.max(0, height - oldHeight);

    // Paint the dirty region at the right, if needed.
    if (right > 0) {
      this._paint(oldWidth, 0, right, height);
    }

    // Paint the dirty region at the bottom, if needed.
    if (bottom > 0) {
      this._paint(0, oldHeight, width - right, bottom);
    }
  }

  /**
   * Paint the portion of the canvas contained within a rect.
   *
   * This is the primary painting entry point. This method invokes
   * all of the other grid drawing methods in the correct order.
   *
   * The rect should be expressed in positive viewport coordinates
   * and have a nonzero area.
   */
  private _paint(rx: number, ry: number, rw: number, rh: number): void {
    // Get the rendering context for the canvas.
    let gc = this._canvas.getContext('2d');

    // Fill the dirty rect with the void space color.
    gc.fillStyle = '#D4D4D4';  // TODO make configurable.
    gc.fillRect(rx, ry, rw, rh);

    // Bail if there is no data model, row header, or column header.
    if (!this._model || !this._rowHeader || !this._columnHeader) {
      return;
    }

    // Fetch the row and column counts from the data model.
    let rowCount = this._model.rowCount();
    let colCount = this._model.columnCount();

    // Bail if the data model is empty.
    if (rowCount === 0 || colCount === 0) {
      return;
    }

    // Compute the upper-left cell index.
    let i1 = this._columnHeader.sectionAt(rx + this._scrollX);
    let j1 = this._rowHeader.sectionAt(ry + this._scrollY);

    // Bail if no cell intersects the origin. Since the scroll position
    // cannot be negative, it means no cells intersect the dirty rect.
    if (i1 < 0 || j1 < 0) {
      return;
    }

    // Compute the lower-right cell index. Note: the queried location
    // is 1 pixel beyond the specified dirty rect. This allows border
    // overdraw by neighboring cells when the dirty rect is aligned
    // with the trailing cell boundaries.
    let i2 = this._columnHeader.sectionAt(rx + rw + this._scrollX);
    let j2 = this._rowHeader.sectionAt(ry + rh + this._scrollY);

    // Use the last cell index if the region is out of range.
    i2 = i2 < 0 ? colCount - 1 : i2;
    j2 = j2 < 0 ? rowCount - 1 : j2;

    // Compute the origin of the cell bounding box.
    let x = this._columnHeader.sectionPosition(i1) - this._scrollX;
    let y = this._rowHeader.sectionPosition(j1) - this._scrollY;

    // Setup the drawing region.
    let rgn: Private.IRegion = {
      x: x, y: y, width: 0, height: 0,
      firstRow: j1, firstColumn: i1,
      rowSizes: [], columnSizes: []
    };

    // Fetch the column sizes and compute the total region width.
    for (let i = 0, n = i2 - i1 + 1; i < n; ++i) {
      let s = this._columnHeader.sectionSize(i1 + i);
      rgn.columnSizes[i] = s;
      rgn.width += s;
    }

    // Fetch the row sizes and compute the total region height.
    for (let j = 0, n = j2 - j1 + 1; j < n; ++j) {
      let s = this._rowHeader.sectionSize(j1 + j);
      rgn.rowSizes[j] = s;
      rgn.height += s;
    }

    // Save the context before applying the clipping rect.
    gc.save();

    // Apply the clipping rect for the specified dirty region.
    gc.beginPath();
    gc.rect(rx, ry, rw, rh);
    gc.clip();

    // Draw the background behind the cells.
    this._drawBackground(gc, rgn);

    // Draw the grid lines for the cells.
    this._drawGridLines(gc, rgn);

    // Draw the actual cell contents.
    this._drawCells(gc, rgn);

    // Restore the context to remove the clipping rect.
    gc.restore();

    // Temporary: draw the painted rect for visual debugging.
    // gc.beginPath();
    // gc.rect(rgn.x + 0.5, rgn.y + 0.5, rgn.width - 1, rgn.height - 1);
    // gc.lineWidth = 1;
    // gc.strokeStyle = Private.nextColor();
    // gc.stroke();
  }

  /**
   * Draw the background for the given grid region.
   */
  private _drawBackground(gc: CanvasRenderingContext2D, rgn: Private.IRegion): void {
    // Setup the rendering context.
    gc.fillStyle = 'white';  // TODO make configurable

    // Fill the dirty rect with the background color.
    gc.fillRect(rgn.x, rgn.y, rgn.width, rgn.height);
  }

  /**
   * Draw the grid lines for the given grid region.
   */
  private _drawGridLines(gc: CanvasRenderingContext2D, rgn: Private.IRegion): void {
    // Setup the rendering context.
    gc.lineWidth = 1;
    gc.lineCap = 'butt';
    gc.strokeStyle = 'gray';  // TODO make configurable

    // Start the path for the grid lines.
    gc.beginPath();

    // Draw the vertical grid lines.
    let y1 = rgn.y;
    let y2 = rgn.y + rgn.height;
    let colSizes = rgn.columnSizes;
    for (let i = 0, x = rgn.x - 0.5, n = colSizes.length; i < n; ++i) {
      x += colSizes[i];
      gc.moveTo(x, y1);
      gc.lineTo(x, y2);
    }

    // Draw the horizontal grid lines.
    let x1 = rgn.x;
    let x2 = rgn.x + rgn.width;
    let rowSizes = rgn.rowSizes;
    for (let j = 0, y = rgn.y - 0.5, n = rowSizes.length; j < n; ++j) {
      y += rowSizes[j];
      gc.moveTo(x1, y);
      gc.lineTo(x2, y);
    }

    // Stroke the path to render the lines.
    gc.stroke();
  }

  /**
   * Draw the cells for the given grid region.
   */
  private _drawCells(gc: CanvasRenderingContext2D, rgn: Private.IRegion): void {
    // Unpack common region variables.
    let startX = rgn.x;
    let startY = rgn.y;
    let firstRow = rgn.firstRow;
    let firstCol = rgn.firstColumn;
    let rowSizes = rgn.rowSizes;
    let colSizes = rgn.columnSizes;
    let rowCount = rowSizes.length;
    let colCount = colSizes.length;

    // Setup the common variables.
    let rendererName = '';
    let model = this._model;
    let renderer: ICellRenderer = null;
    let cellRenderers = this._cellRenderers;

    // Setup the data model cell data object.
    let data: DataModel.ICellData = {
      value: null,
      renderer: '',
      options: null
    };

    // Setup the cell config object.
    let config: ICellConfig = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      row: -1,
      column: -1,
      value: null,
      options: null
    };

    // Iterate over the columns in the region.
    for (let i = 0, x = startX; i < colCount; ++i) {

      // Lookup the column width.
      let width = colSizes[i];

      // Ignore the column if its width is zero.
      if (width === 0) {
        continue;
      }

      // Compute the column index.
      let column = i + firstCol;

      // Iterate over the rows in the column.
      for (let j = 0, y = startY; j < rowCount; ++j) {

        // Lookup the row height.
        let height = rowSizes[j];

        // Ignore the row if its height is zero.
        if (height === 0) {
          continue;
        }

        // Compute the row index.
        let row = j + firstRow;

        // Reset the cell data parameters.
        data.value = null;
        data.renderer = 'default';
        data.options = null;

        // Load the cell data from the data model.
        model.cellData(row, column, data);

        // Fetch the new cell renderer if needed.
        if (data.renderer !== rendererName) {
          rendererName = data.renderer;
          renderer = cellRenderers[rendererName];
        }

        // Bail if there is no renderer for the cell.
        // TODO: draw an error cell?
        if (!renderer) {
          continue;
        }

        // Set the cell config parameters.
        config.x = x;
        config.y = y;
        config.width = width;
        config.height = height;
        config.row = row;
        config.column = column;
        config.value = data.value;
        config.options = data.options;

        // Paint the cell using the selected renderer.
        renderer.paint(gc, config);

        // Finally, increment the running Y coordinate.
        y += height;
      }

      // Finally, increment the running X coordinate.
      x += width;
    }
  }

  /**
   * Handle the `sectionsResized` signal of the grid sections.
   */
  private _onSectionsResized(sender: GridHeader, range: GridHeader.ISectionRange): void { }

  private _scrollX = 0;
  private _scrollY = 0;
  private _model: DataModel = null;
  private _buffer: HTMLCanvasElement;
  private _canvas: HTMLCanvasElement;
  private _rowHeader: GridHeader = null;
  private _columnHeader: GridHeader = null;
  private _cellRenderers = Private.createRendererMap();
}


/**
 * The namespace for the `GridCanvas` class statics.
 */
export
namespace GridCanvas {
  /**
   * An options object for initializing a grid canvas.
   */
  export
  interface IOptions {

  }
}


/**
 * The namespace for the module private data.
 */
namespace Private {
  /**
   * An object which represents the dirty region of a grid.
   *
   * A dirty region is always aligned to whole-cell boundaries.
   */
  export
  interface IRegion {
    /**
     * The X coordinate of the dirty rect.
     *
     * This value corresponds to the canvas coordinates of the left
     * edge of the first cell in the region. It is already adjusted
     * for the grid scroll offset.
     */
    x: number;

    /**
     * The Y coordinate of the dirty rect.
     *
     * This value corresponds to the canvas coordinates of the top
     * edge of the first cell in the region. It is already adjusted
     * for the grid scroll offset.
     */
    y: number;

    /**
     * The width of the dirty rect.
     *
     * This is the total width of all columns in the region.
     */
    width: number;

    /**
     * The height of the dirty rect.
     *
     * This is the total height of all rows in the region.
     */
    height: number;

    /**
     * The index of the first row in the region.
     */
    firstRow: number;

    /**
     * The index of the first column in the region.
     */
    firstColumn: number;

    /**
     * The sizes of the rows in the region.
     */
    rowSizes: number[];

    /**
     * The sizes of the columns in the region.
     */
    columnSizes: number[];
  }

  /**
   * A type alias for a cell renderer map.
   */
  export
  type RendererMap = { [name: string]: ICellRenderer };

  /**
   * Create a new renderer map for a grid canvas.
   */
  export
  function createRendererMap(): RendererMap {
    return Object.create(null);
  }

  const colors = [
    'red', 'green', 'blue', 'yellow', 'orange', 'cyan'
  ];

  let ci = 0;

  export
  function nextColor(): string {
    return colors[ci++ % colors.length];
  }
}