import { BehaviorSubject, Subject} from 'rxjs';
import { Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PDFDocumentProxy, GlobalWorkerOptions, getDocument, PageViewport } from "pdfjs-dist";
import interact from 'interactjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, filter } from 'rxjs/operators';
import { of } from 'rxjs';



interface Position {
  x: number;
  y: number;
}

interface Node {
  key: string;
  type: string;
  position?: Position;
  positions?: Position[];
  width?: number;
  height?: number;
  fontSize?: number;
}

interface NodeDetails {
  key?: string;
  type: string;
  position?: Position; 
  positions?: Position[];
  width?: number;
  height?: number;
  fontSize?: number;
}

interface NodeOverride {
  [key: string]: NodeDetails;
}

interface OutputFormat {
  node_override: NodeOverride;
}


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule],
  template: `
<div class="page-container">
  <div class="pdf-container">
    <canvas #pdfCanvas class="border-canvas"></canvas>

  <div>
  <div class="header-container">
    <p class="available-nodes-heading">Available nodes:</p>
    <button class="button-small" (click)="refreshNodeDescriptions()">Refresh Node Descriptions</button>
  </div>
  <div class="nodes-display">
    <ul>
      <li *ngFor="let description of nodeDescriptions">{{description}}</li>
    </ul>
  </div>
</div>
  </div>

  <div class="config-container">
    <h2>Visual PDF Editor</h2>
  <div class="output-container" [class.hidden]="!outputAvailable">
  <label class="available-nodes-heading"> OUTPUT: </label>
  <div class="button-container">
    <button (click)="copyToClipboard()" class="button-small">Copy To Clipboard</button>
    <button (click)="generateOutput(false)" class="button-small">All Nodes Config</button>
    <button (click)="toggleJoystickVisibility()"  class="button-small">{{ joystickVisible ? 'Hide' : 'Show' }} Joystick</button>
  </div>
  <textarea #outputJson class="output-json" readonly></textarea>
</div>
     <label class="available-nodes-heading"> PDF URL: </label>
    <input type="text" [(ngModel)]="pdfUrl" (ngModelChange)="onPdfUrlChange()" placeholder="Enter PDF URL">
    <label> JSON INPUT: </label>
    <textarea (input)="onJsonInputChange($event)" placeholder="Paste your JSON config here..."></textarea>

<div class="joystick">
  <div class="joystick-controls">
    <div class="direction-controls">
      <button (click)="moveNode('up')" class="button-up">Up</button>
      <div class="horizontal-controls">
        <button (click)="moveNode('left')" class="button-left">Left</button>
        <div class="scale-control">
          
          <input type="number" [(ngModel)]="nodeScale" min="0.1" max="2" step="0.1">
        </div>
        <button (click)="moveNode('right')" class="button-right">Right</button>
      </div>
      <button (click)="moveNode('down')" class="button-down">Down</button>
    </div>
  </div>
  <div class="node-info">
    <p>Last Selected Node: <strong> {{lastInteractedNodeKey}} </strong></p>
    <p>Position: <strong> x={{lastNodePosition?.x}}, y={{lastNodePosition?.y}} </strong></p>
  </div>
</div>


  `,
  styles: [
    `
.page-container {
  display: flex;
  width: 100%;
}

.config-container {
    width: 40%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px;
  }

.pdf-container {
  width: 60%;
}
.output-container {
    width: 100%; 
    padding: 2px;
    margin-top: 10px;
  }

.button-container {
    display: flex;
    justify-content: flex-end; /* Align buttons to the right */
    margin-bottom: 10px; /* Add space below the button container */
  }


.button-small:hover {
  background-color: #0056b3;
}

.button-small {
  padding: 5px 10px;
  margin-left: 10px;
  font-size: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  max-width: 240px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-top: 20px;
}

.available-nodes-heading {
  margin: 0; 
  font-size: 16px; 
}

.config-container {
  width: 40%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

textarea, input[type="text"], .nodes-display, button {
  width: 100%;
  margin: 10px 0;
  border: solid 1px black;
}

.border-canvas{
  border: solid 1px black;
  align-self: start; 
}

.nodes-display ul {
  text-align: center; 
}

button {
  margin: 2px;
  padding: 10px;
  max-width: 400px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

button:hover {
  background-color: #0056b3;
}

textarea {
  height: 300px;
  resize: vertical; 
}


.nodes-display {
  display: flex; 
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
  max-height: 400px; 
  overflow-y: auto; 
}

.nodes-display ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); 
  gap: 10px;
  list-style-type: none;
  padding: 12px;
}

.nodes-display li {
  background-color: #f0f0f0; 
  padding: 5px 10px; 
  border-radius: 5px; 
  border: 1px solid #ccc; 
  width: fit-content;
}

.joystick {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 20px;
  background-color: #f0f0f0;
  border: 2px solid #ccc;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1000;
}

.direction-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.horizontal-controls {
  display: flex;
  justify-content: center;
  align-items: center;
}

.button-up, .button-down, .button-left, .button-right {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  margin: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s ease;
}

.button-up, .button-down {
  width: 100%;
}

.scale-control {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 20px;
}

.scale-control label {
  margin-bottom: 5px;
}

.scale-control input[type="number"] {
  width: 60px;
  padding: 5px;
  text-align: center;
}

.node-info {
  background-color: #e9ecef;
  padding: 10px;
  margin-top: 20px;
  border-radius: 5px;
  border: 1px solid #ccc;
  width: 100%;
  text-align: center;
}

.hidden {
      display: none;
    }

.output-json {
    width: 100%; 
    margin: 0; 
    box-sizing: border-box; /* Include padding and border in the element's width and height */
    height: 300px;
    resize: vertical;
  }

    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit{
  @ViewChild('pdfCanvas', { static: true }) pdfCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('contextMenu') contextMenu!: ElementRef;
  //pdfUrl: string = 'https://storage.googleapis.com/shipthis-media/base/BLIndiaStandard.pdf';
  //pdfUrl: string = 'https://raw.githubusercontent.com/vinodnimbalkar/svelte-pdf/369db2f9edbf5ab8c87184193e1404340729bb3a/public/sample.pdf';
  pdfUrl: string = 'https://storage.googleapis.com/shipthis-media/base/379f6d0d40b6c08888475be4c0969e6e.pdf';
  jsonInput: string = '';
  extractedNodes: string[] = [];
  nodesWithPositions: { key: string; position: Position }[] = [];
  viewBoxWidth: number = 0;
  viewBoxHeight: number = 0;
  viewport: any;
  allNodes: Node[] = [];
  canvas: any;
  nodeDescriptions: string[] = [];
  contextMenuVisible: boolean = false;
  contextMenuPosition = { x: '0px', y: '0px' };
  @ViewChild('outputJson') outputJson!: ElementRef<HTMLTextAreaElement>;
  movedNodes: Map<any, any> = new Map();
  output: OutputFormat = { node_override: {} };
  changeLog: string[] = [];
  lastInteractedNodeKey: string | null = null;
  lastNodePosition: Position | null = null;
  nodeScale: number = 0.5;
  lastInteractedIndex: number | null = null;
  private pdfUrlChange = new Subject<string>();
  private jsonInputChange = new Subject<string>();
  joystickVisible: boolean = true;
  outputAvailable: boolean = false;


  constructor() {
    GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
    this.pdfUrlChange.pipe(
      debounceTime(500), // Adjust debounce time as needed
      distinctUntilChanged()
    ).subscribe(() => {
      this.loadAndRenderPdf();
    });

    this.setupJsonInputChangeSubscription();
  }


  clearExistingNodes(): void {
    document.querySelectorAll('.draggable-node').forEach(node => node.remove());
  }
  
  onJsonInputChange(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.jsonInputChange.next(input.trim());
  }

  private setupJsonInputChangeSubscription(): void {
    this.jsonInputChange.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(jsonString => {
        return new Promise(resolve => {
          try {
            resolve(JSON.parse(jsonString));
          } catch (e) {
            resolve(null); 
          }
        });
      }),
      catchError(err => {
        console.error('Error processing input', err);
        return of(null);
      })
    ).subscribe(json => {
      if (json) {
        this.clearExistingNodes();
        this.generateNodes(json);
      }
    });
  }

  ngAfterViewInit(): void {
    //this.loadAndRenderPdf();
    const savedPdfUrl = sessionStorage.getItem('pdfUrl');
    if (savedPdfUrl) {
      this.pdfUrl = savedPdfUrl;
      this.loadAndRenderPdf();
    } else {
      this.loadAndRenderPdf();
    }
    this.toggleJoystickVisibility();
  }


  generateNodes(json: any): void {
    setTimeout(() => this.parseAndExtractNodes(json), 0);
  }


  onPdfUrlChange(): void {
    this.pdfUrlChange.next(this.pdfUrl);
    sessionStorage.setItem('pdfUrl', this.pdfUrl);
  }

  parseAndExtractNodes(json: any) {
    try {
      
      const nodes: Node[] = json.nodes || [];
      this.allNodes = nodes; 
      nodes.forEach((node) => {
        if (node.position) {
          this.createDraggableNode(node, node.position, -1);
          this.nodeDescriptions.push(`${node.key} at x=${node.position.x}, y=${node.position.y}`);
        } else if (node.positions) {
          node.positions.forEach((position, index) => {
            this.createDraggableNode(node, position, index);
            this.nodeDescriptions.push(`${node.key} ${index + 1} at x=${position.x}, y=${position.y}`);
          });
        }
      });
      this.outputAvailable = true;
      console.log("this was called", this.outputAvailable);
      this.showOutputContainer();
    } catch (error) {
      console.error('Invalid JSON input', error);
      this.outputAvailable = false;
      this.hideOutputContainer();
    }
  }

  showOutputContainer(): void {
    const outputContainer = document.querySelector('.output-container');
    if (outputContainer) {
      outputContainer.classList.remove('hidden');
    }
  }

  hideOutputContainer(): void {
    const outputContainer = document.querySelector('.output-container');
    if (outputContainer) {
      outputContainer.classList.add('hidden');
    }
  }

  loadAndRenderPdf(): void {
    if (!this.pdfUrl) return;
  
    const loadingTask = getDocument(this.pdfUrl);
    loadingTask.promise.then(pdf => {
      pdf.getPage(1).then(page => {
        const viewport = page.getViewport({ scale: 1.0 });
        this.viewport = viewport;
        this.viewBoxWidth = viewport.width;
        this.viewBoxHeight = viewport.height;
        const canvas = this.pdfCanvas.nativeElement;
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        
        if (context) { 
        canvas.height = viewport.height;
        canvas.width = viewport.width;
  
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        page.render(renderContext).promise.then(() => {
          // this.afterPdfRendered();
          console.log("PDF LOADED SUCCESSFULLY");
        });
      }else{
          console.error('Failed to get 2D context');
      }
      });
    }).catch(error => {
      console.error('Error loading PDF:', error);
    });
  }

  // afterPdfRendered(): void {
  //   this.parseAndExtractNodes();
  // }

  createDraggableNode(node: Node, position: Position, index:any): void {
    if (!this.pdfCanvas || !this.pdfCanvas.nativeElement) {
      console.error('Canvas is not initialized yet.');
      return;
    }


    const div = document.createElement('div');
    div.textContent = node.key;
    div.className = 'draggable-node';
    document.body.appendChild(div);
    const canvasRect = this.pdfCanvas.nativeElement.getBoundingClientRect();
    const adjustedX = canvasRect.left + position.x; 
    const scrollTop = document.documentElement.scrollTop || 0;
    const adjustedY = window.scrollY + position.y - scrollTop;
  if (node.width) {
    div.style.width = `${node.width}px`;
  }
  if (node.height) {
    div.style.height = `${node.height}px`;
  }
  div.style.fontSize = '7px';
  div.style.left = `${adjustedX}px`;
  div.style.top = `${adjustedY}px`;
  div.style.position = 'absolute';
  div.style.border = '1px solid blue'; 
  div.style.backgroundColor = 'rgba(0,0,255,0.1)';
  div.setAttribute('data-key', node.key); 
  div.style.cursor = 'grab';
  if(index >= 0){
    this.makeNodeDraggable(div, node, index);
    div.setAttribute('data-index', index.toString());
  }else{
    this.makeNodeDraggable(div, node, -1);
    div.setAttribute('data-index', "");
  }
  }

  makeNodeDraggable(element: HTMLElement, node: NodeDetails, index:number): void {

      const canvasRect = this.pdfCanvas.nativeElement.getBoundingClientRect();
    interact(element).draggable({
      inertia: true,
      modifiers: [
          interact.modifiers.restrictRect({
            restriction: {
              left: canvasRect.left,
              top: 0,
              right: Infinity, 
              bottom: Infinity
            },
              endOnly: true
          })
      ],
      listeners: {
        start: event => {
          event.target.style.transform = `translate(${0}px, ${0}px)`;
          this.lastInteractedNodeKey = event.target.getAttribute('data-key');
          this.lastInteractedIndex = index >= 0 ? index : null;
          const node = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
          if (node) {
            this.lastNodePosition = node.position ? { ...node.position } : { x: 0, y: 0 };
          }
          if(index>=0){
            this.lastInteractedIndex = parseInt(event.target.getAttribute('data-index')) || null;
          }else{
            this.lastInteractedIndex = null;
          }
        },
        move: event => {
          event.target.style.transform = `translate(${0}px, ${0}px)`;
          let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + event.dx;
          let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + event.dy;
          event.target.style.transform = `translate(${x}px, ${y}px)`;
          event.target.setAttribute('data-x', x.toString());
          event.target.setAttribute('data-y', y.toString());
        },

        end: event => {  
        const y = event.rect.top;
        const x = event.rect.left;
         const key = event.target.getAttribute('data-key');
         this.onNodeDragEnd(key, x, y);
         
         if (key !== null) {
          const node = this.allNodes.find(n => n.key === key);
          if (node) {
            
            if (node.positions && index >= 0) {
              node.positions[index] = { x, y };
              this.movedNodes.set(key, { ...node, positions: [...node.positions] });
            } else if (node.position || index === -1) {
              node.position = { x, y };
              this.movedNodes.set(key, { ...node, position: { x, y } });
            }

            this.updateDescriptionsAndAudit(key, index, {x, y});
            this.lastInteractedNodeKey = node.key;
            this.lastNodePosition = { x, y };
          }
        }
        this.selectNodeForJoystick(key, index, {x,y});
        this.refreshNodeDescriptions();
        this.generateOutput(true);
      }
      }
    })
    .on('tap', event => {
      const key = event.currentTarget.getAttribute('data-key');
      this.lastInteractedNodeKey = key;
      this.lastInteractedIndex = index; 
      const node = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
  if (node) {
    const position = index !== null && node.positions ? node.positions[index] : node.position;
    if (position) {
      this.lastNodePosition = { ...position };
      this.updateJoystickPanel();
    }
  }
    });
  }

  selectNodeForJoystick(key: string, index: number | null, position: Position) {
    this.lastInteractedNodeKey = key;
    this.lastInteractedIndex = index;
    this.lastNodePosition = position;
    this.updateJoystickPanel();
  }

  updateJoystickPanel() {
    const joystickInfo = document.querySelector('.node-info');
    if (joystickInfo && this.lastNodePosition) {
      joystickInfo.innerHTML = `Last Selected Node: ${this.lastInteractedNodeKey}<br>Position: x=${this.lastNodePosition.x}, y=${this.lastNodePosition.y}`;
    }
  }

  

  onNodeDragEnd(key: string, x: number, y: number): void {
    const node = this.allNodes.find(n => n.key === key);
    if (node) {
      this.updateNodePosition(key, x, y);
    }
  }


  moveNode(direction: string): void {
    if (!this.lastInteractedNodeKey || this.lastNodePosition === null) return;
    
    const movementAmount = 1* this.nodeScale;
    let dx = 0, dy = 0;
    switch (direction) {
      case 'up': dy -= movementAmount; break;
      case 'down': dy += movementAmount; break;
      case 'left': dx -= movementAmount; break;
      case 'right': dx += movementAmount; break;
    }
  
    const newX = this.lastNodePosition.x + dx;
  const newY = this.lastNodePosition.y + dy;

  
  this.updateNodePosition(this.lastInteractedNodeKey, newX, newY, this.lastInteractedIndex);
  this.lastNodePosition = { x: newX, y: newY };
  this.updateJoystickPanel();
  const selector = this.lastInteractedIndex !== -1
  ? `[data-key='${this.lastInteractedNodeKey}'][data-index='${this.lastInteractedIndex}']`
  : `[data-key='${this.lastInteractedNodeKey}']`;
    const nodeElement = document.querySelector(selector) as HTMLElement;
  if (nodeElement) {
    nodeElement.style.transform = 'translate(0px, 0px)';
    nodeElement.style.left = `${newX}px`;
    nodeElement.style.top = `${newY}px`;
    nodeElement.setAttribute('data-x', newX.toString());
    nodeElement.setAttribute('data-y', newY.toString());
    this.generateOutput(true);
  }

  }
  
  
  
  updateNodePosition(key: string, x: number, y: number, index?: number | null): void {
    const node = this.allNodes.find(n => n.key === key);
    if (!node) return;
  
    if (node.positions && index && index !== null && index >= 0) {
      node.positions[index] = { x, y };
    } else {
      node.position = { x, y };
    }
    this.movedNodes.set(key, { ...node });
  }
  
updateNodeElementPosition(key: string, position: Position, index?: number): void {
  const selector = index !== undefined ? `.draggable-node[data-key='${key}'][data-index='${index}']` : `.draggable-node[data-key='${key}']`;
  const nodeElement = document.querySelector(selector) as HTMLElement;

  if (nodeElement) {
    nodeElement.style.transform = `translate(${position.x}px, ${position.y}px)`;
    
    nodeElement.setAttribute('data-x', position.x.toString());
    nodeElement.setAttribute('data-y', position.y.toString());
    this.lastNodePosition = { x: position.x, y: position.y };
  }
}



  updateDescriptionsAndAudit(key: string, index: number, newPos: Position) {
    const changeDescription = `${key} ${index >= 0 ? index + 1 : ''} at x=${newPos.x}, y=${newPos.y}`;
    this.changeLog.push(changeDescription);
    const descriptionIndex = this.nodeDescriptions.findIndex(desc => desc.includes(`${key} ${index >= 0 ? index + 1 : ''}`));
    if (descriptionIndex >= 0) {
      this.nodeDescriptions.splice(descriptionIndex, 1);
    }
    this.nodeDescriptions.unshift(changeDescription);
    this.refreshNodeDescriptions();
  }


  generateOutput(onlyEdited: boolean): void {
    let output: OutputFormat = { node_override: {} };
  
    this.allNodes.forEach(node => {
      if (onlyEdited && !this.movedNodes.has(node.key)) return;
  
      const nodeDetail: NodeDetails = {
        type: node.type,
        width: node.width,
        height: node.height,
        fontSize: node.fontSize,
      };
      if (node.positions || this.movedNodes.has(node.key)) {
        const updatedNode = this.movedNodes.get(node.key);
        if (updatedNode && updatedNode.positions) {
          nodeDetail.positions = updatedNode.positions;
        } else if (updatedNode && updatedNode.position) {
          nodeDetail.positions = [updatedNode.position];
        } else if (node.positions) {
          nodeDetail.positions = [...node.positions];
        }
      } else if (node.position) {
        nodeDetail.position = { ...node.position };
      }
  
      output.node_override[node.key] = nodeDetail;
    });
  
  
    Object.entries(output.node_override).forEach(([key, detail]) => {
      if (detail.positions && detail.positions.length === 1) {
        detail.position = detail.positions[0];
        delete detail.positions;
      } else if (detail.positions && detail.positions.length === 0) {
        delete detail.positions; 
      }
    });
  
    this.outputJson.nativeElement.value = JSON.stringify(output, null, 2);
  };
  
  copyToClipboard(): void {
    this.outputJson.nativeElement.select();
    document.execCommand('copy');
    alert("Copied config to the clipboard");
  }

  refreshNodeDescriptions(): void {
    this.nodesWithPositions.forEach(node => {
      const description = `${node.key} at x=${node.position.x}, y=${node.position.y}`;
      this.nodeDescriptions.push(description);
    });
  }

  toggleJoystickVisibility(): void {
    this.joystickVisible = !this.joystickVisible; // Toggle the state
    const joystickElement = document.querySelector('.joystick') as HTMLElement;
    if (joystickElement) {
      joystickElement.style.display = this.joystickVisible ? 'block' : 'none';
    }
  }
    
}