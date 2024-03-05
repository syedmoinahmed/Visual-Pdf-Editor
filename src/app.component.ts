import { Subject} from 'rxjs';
import { Component, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import {GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import interact from 'interactjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import {ContextMenuComponent} from './contextMenu.component';


interface Position {
  x: number;
  y: number;
}

interface MenuActionEvent {
  action: string;
  data?: any; 
}

interface Node {
  key: string;
  type: string;
  position?: Position;
  positions?: Position[];
  width?: number;
  height?: number;
  fontSize?: number;
  children?: any[];
  maxLines?: number;
}

interface NodeDetails {
  key?: string;
  type: string;
  position?: Position; 
  positions?: Position[];
  width?: number;
  height?: number;
  fontSize?: number;
  children?: ChildNode[];
  maxLines?: number;
}

interface NodeOverride {
  [key: string]: NodeDetails;
}

interface OutputFormat {
  node_override: NodeOverride;
}

interface ChildNode {
  type: string;
  fontSize: number;
  padding: number;
  width: number;
}

interface newNode {
  name: string; 
  x: number; 
  y: number; 
  height?:number; 
  width?:number; 
  fontSize?:number; 
  type:string;
  children?: ChildNode[];
  maxLines?: number;
}


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule, ReactiveFormsModule, ContextMenuComponent],
  template: `
<div class="page-container">
  <div class="pdf-container">
  <app-context-menu (menuAction)="handleMenuAction($event)" class="z-99"></app-context-menu>
    <canvas #pdfCanvas class="border-canvas"></canvas>
    <div id="contextMenu" class="context-menu" style="display: none;">
  <ul>
    <li id="option1">{{joystickVisible?'Hide':'Show'}} Joystick</li>
    <li id="option2">Edit Node Details</li>
    <li id="option3">Duplicate Node</li>
    <li id="option4">Delete Node</li>
  </ul>
</div>
  <div>
  <div class="header-container">
    <p class="available-nodes-heading">Available nodes:</p>
    <button class="refreshbutton" (click)="refreshNodeDescriptions()">Refresh Audit</button>
  </div>
  <div class="nodes-display">
    <ul>
      <li *ngFor="let description of nodeDescriptions">{{description}}</li>
    </ul>
  </div>
</div>
  </div>
  <div class="node-dialog" *ngIf="showNodeDialog">
  <div class="dialog-content">
    <h2>Add New Node</h2>
    <br>
    <div class="form-container">
      <div class="left-column">

      <div *ngIf="allNodes.length > 0">
          <label for="duplicateNodeSelect">Duplicate Existing Node:</label>
          <select id="duplicateNodeSelect" [(ngModel)]="selectedNodeKey" (change)="onNodeSelect()">
            <option value="" disabled selected>Select a node to duplicate</option>
            <option *ngFor="let node of allNodes" [ngValue]="node.key">{{node.key}}</option>
          </select>
        </div>

        <label for="nodeName">Node Name:</label>
        <input type="text" id="nodeName" [(ngModel)]="newNode.name" placeholder="node_name" [disabled]='showOnlyDuplicateFields'>

        <div *ngIf="!showOnlyDuplicateFields">
        <label for="typeId">Type:</label>
        <select id="typeId" [(ngModel)]="newNode.type">
        <option *ngFor="let type of nodeTypes" [ngValue]="type">{{ type }}</option>
        </select>
        </div>

      

      <div *ngIf="newNode.type === 'table'" class="child-nodes-container">
  <label for="node-maxLines">Max Lines:</label>
  <input type="number" id="node-maxLines" [(ngModel)]="newNode.maxLines" placeholder="Max Lines" required>


  <br>
  <label for="childrenCount">Number of Children:</label>
  <input type="number" id="childrenCount" [(ngModel)]="childrenCount" placeholder="Number of Children" required>
  <button (click)="generateChildren()">Generate Children</button>

  <br>
  <div class="children-cards">
    <div *ngFor="let child of newNode.children; let i = index" class="child-card">
      <h4>Child {{i + 1}}</h4>
      <label for="child-width-{{i}}">Width:</label>
      <input type="number" id="child-width-{{i}}" [(ngModel)]="child.width" placeholder="Width" required>

      <label for="child-fontSize-{{i}}">Font Size:</label>
      <input type="number" id="child-fontSize-{{i}}" [(ngModel)]="child.fontSize" placeholder="Font Size">

      <label for="child-padding-{{i}}">Padding:</label>
      <input type="number" id="child-padding-{{i}}" [(ngModel)]="child.padding" placeholder="Padding">
    </div>
  </div>
</div>

<div *ngIf="newNode.type === 'multiple_text'" class="child-nodes-container">
<label for="node-maxLines">Max Lines:</label>
  <input type="number" id="node-maxLines" [(ngModel)]="newNode.maxLines" placeholder="Max Lines" required>
</div>

      </div>
      <div class="right-column">
      <label for="nodeX">X Position:</label>
        <input type="number" id="nodeX" [(ngModel)]="newNode.x" placeholder="X" required>

        <label for="nodeY">Y Position:</label>
        <input type="number" id="nodeY" [(ngModel)]="newNode.y" placeholder="Y" required>

        <div  *ngIf="!showOnlyDuplicateFields">
        <label for="node-width">Width:</label>
        <input type="number" id="node-width" [(ngModel)]="newNode.width" placeholder="Width" required>
        </div>

        <div  *ngIf="!showOnlyDuplicateFields">
        <label for="node-height">Height:</label>
        <input type="number" id="node-height" [(ngModel)]="newNode.height" placeholder="Height" required>
        </div>

        <div  *ngIf="!showOnlyDuplicateFields">
        <label for="node-font">Font Size:</label>
        <input type="number" id="node-font" [(ngModel)]="newNode.fontSize" placeholder="Font Size" required>
        </div>
      </div>
    </div>
    <div class="dialog-actions">
      <button (click)="cancelNewNode()">Cancel</button>
      <button (click)="confirmNewNode(saveType)">Confirm</button>
    </div>
  </div>
</div>


<div class="node-dialog" *ngIf="showDuplicateModal">
  <div class="dialog-content">
    <h3>Duplicate New Node</h3>
    <br>
    <label for="nodeName">Node Name:</label>
    <input type="text" id="nodeName" [(ngModel)]="newNode.name" placeholder="node_name" required [disabled]="true">
    
    <label for="nodeX">X Position:</label>
    <input class="p-3" type="number" id="nodeX" [(ngModel)]="newNode.x" placeholder="X" required>
    
    <label for="nodeY">Y Position:</label>
    <input class="p-3" type="number" id="nodeY" [(ngModel)]="newNode.y" placeholder="Y" required>
    
    <div class="dialog-actions">
      <button (click)="cancelNewNode()">Cancel</button>
      <button (click)="confirmDuplicateNode()">Confirm</button>
    </div>
  </div>
</div>

  <div class="config-container">
  <div class="centered-heading">
    <h2>Visual PDF Editor</h2>
</div>
  <div class="output-container" [class.hidden]="!outputAvailable">
  <label class="available-nodes-heading"> OUTPUT: </label>
  <div class="button-container">
    <button (click)="copyToClipboard()" class="button-small">Copy To Clipboard</button>
    <button (click)="generateOutput(false)" class="button-small">All Nodes Config</button>
    <button (click)="toggleJoystickVisibility()"  class="button-small">{{ joystickVisible ? 'Hide' : 'Show' }} Control Panel</button>
  </div>
  <textarea #outputJson class="output-json" readonly></textarea>
</div>
     <label class="available-nodes-heading"> PDF URL: </label>
    <input type="text" [value]="pdfUrl" (input)="onPdfUrlChange($event.target.value)" placeholder="Enter PDF URL">
    <label class="available-nodes-heading"> JSON INPUT: </label>
    <textarea (input)="onJsonInputChange($event)" placeholder="Paste your JSON config here..."></textarea>

<div class="joystick">
<button class="close-button" (click)="toggleJoystickVisibility()">Close Control Panel</button>
  <div class="joystick-controls">
    <div *ngIf="!isChildContextOnly" class="direction-controls">
    <div class="joystick-section">
    <h4>Directions:</h4>
    <div class="direction-controls">
      <button (click)="moveNode('up')" class="button-up">Up</button>
      <div class="horizontal-controls">
        <button (click)="moveNode('left')" class="button-left">Left</button>
        <div class="scale-control">
          
        <input type="number" [formControl]="nodeScale" min="0.1" max="2" step="0.1">
        </div>
        <button (click)="moveNode('right')" class="button-right">Right</button>
      </div>
      <button (click)="moveNode('down')" class="button-down">Down</button>
    </div>
    </div>
</div>
  </div>
 
  <div *ngIf="!isChildContextOnly" class="dimension-controls">
  <div class="joystick-section">
  <h4>Dimensions</h4>
  <div class="dimension-controls">
    <label>Width:</label>
    <button (click)="changeDimension('width', -1)">-</button>
    <input type="number" [formControl]="widthScale" min="0.1" max="2" step="0.1">
    <button (click)="changeDimension('width', 1)">+</button>

    <label>Height:</label>
    <button (click)="changeDimension('height', -1)">-</button>
    <input type="number" [formControl]="heightScale" min="0.1" max="2" step="0.1">
    <button (click)="changeDimension('height', 1)">+</button>
  </div>
  </div>
  </div>
<div *ngIf="isChildContextOnly" class="dimension-controls">
  <div class="joystick-section">
  <h4>Editing: {{ convertToInt(tempNode.key)}}</h4>
  <div class="dimension-controls">
  <label>Width:</label>
    <button (click)="adjustChildDimension('width', -1)">-</button>
    {{selectedChildNode.width}}
    <button (click)="adjustChildDimension('width', 1)">+</button>
 
    <label>Padding:</label>
    <button (click)="adjustChildDimension('padding', -1)">-</button>
    {{selectedChildNode.padding}}
    <button (click)="adjustChildDimension('padding', 1)">+</button>
  </div>
</div>
</div>
  <div *ngIf="!isChildContextOnly" class="z-index-controls">
  <div class="joystick-section">
  <label>Z-index:</label>
  <div class="z-index-controls">
  <button (click)="adjustZIndex(-1)">-</button>
  <button (click)="adjustZIndex(1)">+</button>
  <div class="joystick-section">
  </div>    
</div>
  <div class="node-info text-center">
    <p>Selected Node: <strong> {{lastInteractedNodeKey}} </strong></p>
    <p>POS: <strong> x={{lastNodePosition?.x}}, y={{lastNodePosition?.y}} </strong></p>
  </div>
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
  align-items: flex-start;
  padding: 20px;
  gap: 10px;
  background-color: #f2f2f2;
  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);
  transition: 0.3s;
}
.pdf-container {
  width: 60%;
}
.output-container {
  width: 100%;
  padding: 10px;
  margin-top: 20px;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
  transition: all 0.3s cubic-bezier(.25,.8,.25,1);
}

.button-container {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  margin-bottom: 10px;
}

.button-small {
  padding: 8px 15px;
  font-size: 14px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.refreshbutton{
  padding: 8px 15px;
  font-size: 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  max-width:140px;
  transition: background-color 0.3s ease;
}

.button-small:hover {
  background-color: #45a049;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-top:60px;
}

.available-nodes-heading, h2 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

h2 {
  color: black;
  font-size: 24px;
}

textarea, input[type="text"], .nodes-display {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
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
  background-color: #f9f9f9;
  padding: 2px;
  margin: 2px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.joystick {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 6px;
  background-color: #ffffff;
  border: 2px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.18), 0 2px 3px rgba(0,0,0,0.26);
  z-index: 1000;
  max-height: 90vh; 
  overflow-y: auto; 
}

.direction-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.horizontal-controls {
  display: flex;
  padding: 4px;
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

.centered-heading {
  text-align: center;
  background-color: #cbf7c7; 
  color: white;
  padding: 10px 0;
  margin-bottom: 20px;
  width: 100%;
  border-radius: 4px;
  box-sizing: border-box;
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
  border: 1px solid #ccc;
  border-radius: 4px;
}

.joystick-section {
  margin-bottom: 10px;
  padding: 10px;
  background-color: #d9e2ff;
  border-radius: 6px;
}

.joystick-section h4 {
  margin: 0 0 10px 0;
  padding-bottom: 5px;
  border-bottom: 1px solid #ccc;
}

.direction-controls,
.dimension-controls,
.z-index-controls {
  display: flex;
  align-items: center;
  justify-content: center;
}

.direction-controls button,
.dimension-controls button,
.z-index-controls button {
  background-color: #5c85d6;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  margin: 0 5px;
  cursor: pointer;
  font-size: 14px;
}

.direction-controls button:hover,
.dimension-controls button:hover,
.z-index-controls button:hover {
  background-color: #3e64b0;
}

.scale-control input,
.dimension-controls input {
  text-align: center;
  margin: 0 5px;
  width: 50px;
}

.node-info {
  margin-top: 20px;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 5px;
  border: 1px solid #ddd;
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
    font-family: monospace;
  }

  .close-button {
      position: relative;
      top: -10;
      right: 0;
      margin-bottom:2px;
      border: none;
      background-color: transparent;
      color: #333;
      font-size: 16px;
      cursor: pointer;
    }


  .node-dialog {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
  overflow-y: auto;
  background-color: rgba(0, 0, 0, 0.5);
}

.dialog-content {
  width: 75%;
  background-color: #fff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  max-height: 90vh; 
  overflow-y: auto; 
}

.form-container {
  display: flex;
  justify-content: space-between;
}

.left-column, .right-column {
  display: flex;
  flex-direction: column;
  width: 48%;
}

.label {
  margin-bottom: 5px;
  color: #333;
  font-weight: bold;
}

input[type="text"], input[type="number"] {
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.dialog-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

button {
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  border: none;
  transition: background-color 0.3s;
}

button:hover {
  opacity: 0.8;
}

.cancel-button {
  background-color: #f44336;
  color: white;
}

.confirm-button {
  background-color: #4caf50;
  color: white;
}

@media (max-width: 768px) {
  .form-container {
    flex-direction: column;
  }
  .left-column, .right-column {
    width: 100%;
  }
}

select {
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  width: 100%;
  box-sizing: border-box;
}


.context-menu {
  border: 1px solid #ccc;
  box-shadow: 2px 2px 5px #888;
  background-color: white;
  position: absolute;
  z-index: 1000;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu ul li {
  padding: 8px 12px;
  cursor: pointer;
}

.context-menu ul li:hover {
  background-color: #f0f0f0;
}
/* ...existing styles... */

.child-nodes-container {
  border: 1px solid #ddd;
  padding: 10px;
  margin-top: 20px;
  background-color: #f9f9f9;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.children-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-height: 400px; /* Adjust the height as needed */
  overflow-y: auto;
  align-items: flex-start;
}

.child-card {
  width: calc(50% - 5px); /* Adjust the spacing based on the gap */
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
}

.child-card h4 {
  margin: 0 0 10px 0;
  padding-bottom: 5px;
  border-bottom: 1px solid #eee;
}

.child-card label {
  display: block;
  margin: 5px 0;
}

.child-card input[type="number"] {
  width: 100%;
  padding: 8px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}


    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit{
  @ViewChild('pdfCanvas', { static: true }) pdfCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('contextMenu') contextMenu!: ElementRef;
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
  nodeScale = new FormControl(0.5);
  widthScale = new FormControl(1);
  heightScale = new FormControl(1);
  lastInteractedIndex: number | null = null;
  private pdfUrlChange = new Subject<string>();
  private jsonInputChange = new Subject<string>();
  joystickVisible: boolean = true;
  outputAvailable: boolean = false;
  selectedNodeWidth: number | null = null;
  selectedNodeHeight: number | null = null;
  selectedNodeZIndex: number = 10;
  showNodeDialog = false;
  nodeTypes: string[] = ['text', 'bar_code', 'date', 'image', 'multiple', 'multiple_text', 'table', 'sub'];
  newNode:newNode = { name: '', x: 0, y: 0, type: 'text', children:[]};
  childrenCount: number = 0;
  saveType:string = 'new';
  selectedChildNode:any;
  selectedChildIndex: any;
  lastSelectedParentKey: any;
  isChildContextOnly:boolean = false;
  showDuplicateModal = false;
  selectedNodeKey: string = '';
  tempNode: any={};
  showOnlyDuplicateFields = false;
  @ViewChild(ContextMenuComponent) contextMenuComponent!: ContextMenuComponent;

constructor() {
    GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.mjs';
    this.nodeScale.valueChanges.pipe(
      debounceTime(300), 
      distinctUntilChanged() 
    ).subscribe(newValue => {
      console.log('New nodeScale value:', newValue);
    });
    this.widthScale.valueChanges.pipe(
      debounceTime(300), 
      distinctUntilChanged() 
    ).subscribe(newValue => {
      console.log('New widthScale value:', newValue);
    });
    this.heightScale.valueChanges.pipe(
      debounceTime(300), 
      distinctUntilChanged() 
    ).subscribe(newValue => {
      console.log('New heightScale value:', newValue);
    });
    this.setupJsonInputChangeSubscription();
    
  }

ngAfterViewInit(): void {
    const savedPdfUrl = sessionStorage.getItem('pdfUrl');
    if (savedPdfUrl) {
      this.pdfUrl = savedPdfUrl;
      this.loadAndRenderPdf(this.pdfUrl);
    } else {
      this.loadAndRenderPdf(this.pdfUrl);
    }
    this.toggleJoystickVisibility();
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.setupContextMenuOptions();
  }

  handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
        this.moveNode('up');
        break;
      case 'ArrowDown':
        this.moveNode('down');
        break;
      case 'ArrowLeft':
        this.moveNode('left');
        break;
      case 'ArrowRight':
        this.moveNode('right');
        break;
      default:
        // Ignoring other keys
        return;
    }
  
    
    event.preventDefault();
  }

  convertToInt(numberString: any): string {
    const match = numberString.match(/(\d+)$/);
    if (match) {
      const lastNumber = parseInt(match[0], 10);
      const incrementedNumber = lastNumber + 1;
      return numberString.replace(/(\d+)$/, incrementedNumber.toString());
    }else{
      return 'Child';
    }
  }

  handleMenuAction(event: MenuActionEvent) {
    switch(event.action) {
      case 'addNode':
        this.addNewNodeFromMenu(event);
        break;
      
    }
  }

  onNodeSelect(): void {
    const selectedNode = this.allNodes.find(node => node.key === this.selectedNodeKey);
    if (selectedNode) {
      this.newNode.name = selectedNode.key;
      this.showOnlyDuplicateFields = true;
    } else {
      this.newNode.name = '';
      this.showOnlyDuplicateFields = false;
    }
  }

  setupContextMenuOptions(): void {
    document.getElementById('option1')?.addEventListener('click', () => this.toggleJoystickVisibility());
    document.getElementById('option2')?.addEventListener('click', () => this.editTheSelectedNode());
    document.getElementById('option3')?.addEventListener('click', () => this.duplicateNode());
    document.getElementById('option4')?.addEventListener('click', () => this.deleteNode());
  }

  deleteNode(){
    const node = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
    if(node) {
      this.removeAllVisualNodesByKey(node?.key!);
      if(this.lastInteractedIndex !== undefined && this.lastInteractedIndex !==-1){
        if (node.positions && node.positions.length > 0) {
        node.positions?.splice(this.lastInteractedIndex as number, 1);
        if (node.positions?.length === 1) {
          const lastPosition = node.positions[0];
          delete node.positions; 
          node.position = lastPosition; 
          this.createDraggableNode(node, node.position, -1);
      }else{
        node.positions?.forEach((position, index) => {
          this.createDraggableNode(node, position, index);
      });
      }
      this.allNodes = this.allNodes.map(n => n.key === node.key ? node : n);
      this.generateOutput(true);
    }
      }else{
        this.removeAllVisualNodesByKey(node?.key!);
        this.allNodes = this.allNodes.filter(n => n.key !== node.key);
        this.generateOutput(true);
      }
    }else{
      alert('Cant delete this node, please try again');
    }
  }

  confirmDuplicateNode(){
    this.showDuplicateModal = false;
    this.confirmNewNode('new');
  }

  duplicateNode(){
    const node = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
    if(node?.type === 'table'){
      alert('Cant duplicate a table node, please create a new one');
      return;
    }
    this.newNode.name = node?.key!;
    this.showDuplicateModal = true;
  }

  generateChildren() {
    if(!this.newNode.width || this.newNode.width == 0){
      alert('Please add table width to continue!');
      return;
    }
    const defaultWidth = Math.floor(this.newNode.width / this.childrenCount);
    this.newNode.children = Array.from({ length: this.childrenCount }, () => ({
      type: 'text',
      fontSize: this.newNode.fontSize || 7, 
      padding: 5, 
      width: defaultWidth
    }));
  }

  editTheSelectedNode(){
    const node = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
    this.newNode.name = node?.key || '';
    this.newNode.height = node?.height;
    this.newNode.width = node?.width;
    this.newNode.type = node?.type || '';
    this.newNode.fontSize = node?.fontSize;
    this.newNode.x = node?.position?.x || 0;
    this.newNode.y = node?.position?.y || 0;
    this.saveType = 'edit';
    this.showNodeDialog = true; 
    // const existingNodeIndex = this.allNodes.findIndex(node => node.key === node.key);
    // if (existingNodeIndex !== -1) {
    //     this.removeAllVisualNodesByKey(nodeName);
    //     const existingNode = this.allNodes[existingNodeIndex];
    //     if (existingNode.position) {
    //         existingNode.positions = [{ x: existingNode.position.x, y: existingNode.position.y }];
    //         delete existingNode.position;
    //     }
    //     existingNode.positions?.push({ x: this.newNode.x, y: this.newNode.y });

       
    //     this.allNodes[existingNodeIndex] = existingNode;
    //     existingNode.positions?.forEach((position, index) => {
    //         this.createDraggableNode(existingNode, position, index);
    //     });
    // } 
  }
  
  //CREATION AND LOADING of nodes and pdf
loadAndRenderPdf(url: string): void {
    //This method loads the pdf on every url change
    if (!url) {
      console.error('PDF URL is not set.');
      return;
    }
    const loadingTask = getDocument(url);
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
          console.log("PDF LOADED SUCCESSFULLY");
        });
      }else{
          console.error('Failed to get 2D context');
          alert("error loading pdf, please recheck the pdf url");
      }
      });
    }).catch(error => {
      console.error('Error loading PDF:', error);
      alert("error loading pdf");
    });
  }

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
  div.style.zIndex = '10';
  div.style.cursor = 'grab';
  if(index >= 0){
    this.makeNodeDraggable(div, index);
    div.setAttribute('data-index', index.toString());
  }else{
    this.makeNodeDraggable(div, -1);
    div.setAttribute('data-index', "");
  }

 // div.addEventListener('contextmenu', (event) => this.showContextMenu(event));
  
}

showContextMenu(event: MouseEvent): void {
  event.preventDefault();
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu) return;
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  const hideMenu = () => {
    contextMenu.style.display = 'none';
    document.removeEventListener('click', hideMenu);
  };
  document.addEventListener('click', hideMenu);
}

makeNodeDraggable(element: HTMLElement, index:number): void {

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
        this.resetNodeColors();
        this.isChildContextOnly = false;
        const target = event.target as HTMLElement;
        this.selectedNodeZIndex = parseInt(target.style.zIndex) || 11;
        target.style.backgroundColor = 'rgba(255,0,0,0.1)'; 
        target.style.border = '1px solid red';
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
        const initialX = parseFloat(element.style.left) - canvasRect.left;
        const initialY = parseFloat(element.style.top);
        element.setAttribute('data-x', initialX.toString());
        element.setAttribute('data-y', initialY.toString());
        this.updateJoystickPanel();
      },
      move: event => {
        
        //event.target.style.transform = `translate(${0}px, ${0}px)`;
        let x = (parseFloat(event.target.getAttribute('data-x')) || 0) + event.dx;
        let y = (parseFloat(event.target.getAttribute('data-y')) || 0) + event.dy;
        //event.target.style.transform = `translate(${x}px, ${y}px)`;
        event.target.style.left = `${x + canvasRect.left}px`; // Adjust for canvas offset
        event.target.style.top = `${y}px`;
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
      event.target.style.backgroundColor = 'rgba(255,0,0,0.1)'; //laal rang
      event.target.style.border = '1px solid red';
      this.selectedNodeZIndex = event.target.zIndex;
    }
    }
  })
  .on('tap', event => {
    const key = event.currentTarget.getAttribute('data-key');
    this.isChildContextOnly = false;
    this.lastInteractedNodeKey = key;
    this.lastInteractedIndex = index; 
    const node = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
if (node) {
  const position = index !== null && node.positions ? node.positions[index] : node.position;
  if (position) {
    this.lastNodePosition = { ...position };
  }
  event.currentTarget.addEventListener('contextmenu', (event:any) => this.showContextMenu(event));
  this.selectedNodeWidth = node.width || 0;
  this.selectedNodeHeight = node.height || 0;
  this.updateJoystickPanel();
}

this.resetNodeColors();
const target = event.target as HTMLElement;   
target.style.backgroundColor = 'rgba(255,0,0,0.1)'; 
target.style.border = '1px solid red';
  });
}

resetNodeColors(): void {
  document.querySelectorAll('.draggable-node').forEach(node => {
    const element = node as HTMLElement;
    if(element.getAttribute('type') && element.getAttribute('type') === 'table'){
      element.style.backgroundColor = 'rgba(0,0,0,0)';
    }else{
      element.style.backgroundColor = 'rgba(0,0,255,0.1)';
    }
    
    element.style.border = '1px solid blue';
  });

  document.querySelectorAll('.table-child').forEach(node =>{
    const ele = node as HTMLElement;
    ele.style.backgroundColor = 'rgba(255, 255, 0, 0.1)'; 
    ele.style.border = '1px solid orange'; 
  })
}

changeDimension(dimension: 'width' | 'height', change: number): void {
  if (!this.lastInteractedNodeKey) return;
  const node = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
  if (!node) return;
  const currentDimension = dimension === 'width' ? node.width : node.height;
  const newDimension = dimension === 'width' ?(currentDimension || 0) + change*this.widthScale.value! : (currentDimension || 0) + change*this.heightScale.value!;
  if (dimension === 'width') {
    this.selectedNodeWidth = newDimension > 0 ? newDimension : 0;
    node.width = this.selectedNodeWidth;
  } else {
    this.selectedNodeHeight = newDimension > 0 ? newDimension: 0;
    node.height = this.selectedNodeHeight;
  }

  this.updateNodeElementSize(this.lastInteractedNodeKey);
  this.generateOutput(true);
  this.updateJoystickPanel();
}

adjustZIndex(change: number): void {
  if (!this.lastInteractedNodeKey) return;

  const selector = this.lastInteractedIndex !== -1
    ? `[data-key='${this.lastInteractedNodeKey}'][data-index='${this.lastInteractedIndex}']`
    : `[data-key='${this.lastInteractedNodeKey}']`;
  const nodeElement = document.querySelector(selector) as HTMLElement;

  if (nodeElement) {
    let newZIndex = parseInt(nodeElement.style.zIndex) || 10;
    newZIndex = Math.max(5, newZIndex + change); 
    nodeElement.style.zIndex = `${newZIndex}`;
    this.selectedNodeZIndex = newZIndex; 
    this.updateJoystickPanel();
  }
}

updateNodeElementSize(key: string): void {
  const node = this.allNodes.find(n => n.key === key);
  if (!node) return;




let selector = `[data-key='${this.lastInteractedNodeKey}']`;


const nodeElements = document.querySelectorAll(selector);


if (!nodeElements.length) return;


nodeElements.forEach((element) => {
  const el = element as HTMLElement; 
  el.style.width = `${node.width}px`;
  el.style.height = `${node.height}px`;
});
}

generateNodes(json: any): void {
  setTimeout(() => this.parseAndExtractNodes(json), 0);
}

parseAndExtractNodes(json: any) {
  try {
    
    const nodes: Node[] = json.nodes || [];
    this.allNodes = nodes; 
    nodes.forEach((node) => {
      if(node.type === 'table'){
        this.createTableWithChildren(node);
      }else if (node.position) {
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
    this.showOutputContainer();
  } catch (error) {
    console.error('Invalid JSON input', error);
    alert("INVALID JSON");
    this.outputAvailable = false;
    this.hideOutputContainer();
  }
}

createTableWithChildren(tableNode: Node) {
  if (!this.pdfCanvas || !this.pdfCanvas.nativeElement) {
    console.error('Canvas is not initialized yet.');
    return;
  }

  const tableDiv = document.createElement('div');
  tableDiv.className = 'draggable-node';
  tableDiv.style.width = `${tableNode.width}px`;
  tableDiv.style.position = 'absolute';
  tableDiv.style.border = '1px solid blue'; 
  tableDiv.setAttribute('data-key', tableNode.key);
  tableDiv.setAttribute('type', "table");
  tableDiv.style.zIndex = '10';
  tableDiv.style.cursor = 'grab';
  tableDiv.style.overflowX = 'visible';
  tableDiv.style.height = `50px`;
  let totalWidthUsed = 0;
 // let currentTop = 0;
  tableDiv.setAttribute('data-index', "");

  const canvasRect = this.pdfCanvas.nativeElement.getBoundingClientRect();
  const adjustedX = canvasRect.left + tableNode?.position!.x; 
  const scrollTop = document.documentElement.scrollTop || 0;
  const adjustedY = window.scrollY + tableNode?.position!.y - scrollTop;


  tableNode?.children?.forEach((child, index) => {

    tableDiv.style.left = `${adjustedX}px`;
    tableDiv.style.top = `${adjustedY}px`;
    const childDiv = document.createElement('div');
    childDiv.setAttribute('data-child-id', index.toString());
    childDiv.textContent = `Child ${index+1}`;
    childDiv.className = 'table-child';
    childDiv.style.width = `${child.width}px`;
    childDiv.style.padding = `${child.padding}px`;
    childDiv.style.top = `1px`; //only for visibility
    childDiv.style.left = `${totalWidthUsed}px`;
    childDiv.style.position = 'absolute';
    childDiv.style.backgroundColor = 'rgba(255, 255, 0, 0.1)'; 
    childDiv.style.border = '1px solid orange'; 
    
    tableDiv.appendChild(childDiv);
    totalWidthUsed += child.width;

    childDiv.addEventListener('click', () => {
      this.selectChildNode(child, index, tableNode.key);
    });
  });
  document.body.appendChild(tableDiv);
  this.makeNodeDraggable(tableDiv, -1);
}

selectChildNode(childNode: ChildNode, index: number, parentKey:any): void {
  this.isChildContextOnly = true;
  this.selectedChildNode = childNode;
  this.selectedChildIndex = index;
  this.lastSelectedParentKey = parentKey;
  this.selectedChildNode.width = childNode.width;
  this.selectedChildNode.padding = childNode.padding;
  this.tempNode.key = `child ${index}`;
}

adjustChildDimension(type: string, amount:number){
if(!this.selectedChildNode){
  alert("Select a child in the table");
  return;
}

const parentDiv = document.querySelector(`div[data-key="${this.lastSelectedParentKey}"]`);
  if (!parentDiv) {
    console.log("Parent div not found");
    return;
  }

  const childDivs = parentDiv.querySelectorAll('.table-child');
  let adjustmentMade = false;

  childDivs.forEach((childDiv, index) => {
    const childId = parseInt(childDiv.getAttribute('data-child-id') ?? "0");
    if (childId === this.selectedChildIndex) {
      const childHTMLElement = childDiv as HTMLElement; 
      if (type === 'width') {
        const currentWidth = parseInt(childHTMLElement.style.width.replace('px', ''));
        const newWidth = currentWidth + amount;
        childHTMLElement.style.width = `${newWidth}px`;
      } else if (type === 'padding') {
        const currentPadding = parseInt(childHTMLElement.style.padding.replace('px', ''));
        const newPadding = currentPadding + amount;
        childHTMLElement.style.padding = `${newPadding}px`;
      }
      adjustmentMade = true;
      this.updateNodeDimensions(this.lastSelectedParentKey, childId, type, amount);
    } else if (adjustmentMade && index > 0) {
      const childHTMLElement = childDiv as HTMLElement; 
      const previousChildDiv = childDivs[index - 1] as HTMLElement;
      const previousChildRight = previousChildDiv.offsetLeft + previousChildDiv.offsetWidth;
      childHTMLElement.style.left = `${previousChildRight}px`;
    }
  });
}

updateNodeDimensions(parentKey: string, childIndex: number, type: string, amount: number) {
  const parentNode = this.allNodes.find(node => node.key === parentKey);
  if (parentNode && parentNode.children && parentNode.children[childIndex]) {
    const childNode = parentNode.children[childIndex];
    if (type === 'width') {
      childNode.width = (childNode.width || 0) + amount;
    } else if (type === 'padding') {
      childNode.padding = (childNode.padding || 0) + amount;
    }
    //this.movedNodes.set(parentKey, { ...parentNode });
    this.generateOutput(true);
  }
}


onPdfUrlChange(newUrl: string): void {
    this.pdfUrl = newUrl;
    this.pdfUrlChange.next(this.pdfUrl);
    sessionStorage.setItem('pdfUrl', this.pdfUrl);
    this.loadAndRenderPdf(this.pdfUrl);
  }

onJsonInputChange(event: Event): void {
    const input = (event.target as HTMLInputElement).value;
    this.jsonInputChange.next(input.trim());
  }

clearExistingNodes(): void {
    document.querySelectorAll('.draggable-node').forEach(node => node.remove());
  }

copyToClipboard(): void {
    this.outputJson.nativeElement.select();
    document.execCommand('copy');
    alert("Copied config to the clipboard");
  }

toggleJoystickVisibility(): void {
    this.joystickVisible = !this.joystickVisible; // Toggle the state
    const joystickElement = document.querySelector('.joystick') as HTMLElement;
    if (joystickElement) {
      joystickElement.style.display = this.joystickVisible ? 'block' : 'none';
    }
  }



moveNode(direction: string): void {
  if (!this.lastInteractedNodeKey || this.lastNodePosition === null) return;
  const movementAmount = 1 * this.nodeScale.value!;
  let dx = 0, dy = 0;
  switch (direction) {
    case 'up': dy -= movementAmount; break;
    case 'down': dy += movementAmount; break;
    case 'left': dx -= movementAmount; break;
    case 'right': dx += movementAmount; break;
  }

  const newX = this.lastNodePosition.x + dx;
  const newY = this.lastNodePosition.y + dy;

  if(newX < 0 || newY < 0){
    alert("node is overflowing the bounds");
    return;
  }

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

  if (node.positions && typeof index === 'number' && index >= 0) {
    node.positions[index] = { x, y };
  } else {
    node.position = { x, y };
  }
  this.movedNodes.set(key, { ...node });
}

selectNodeForJoystick(key: string, index: number | null, position: Position) {
  this.lastInteractedNodeKey = key;
  this.lastInteractedIndex = index;
  this.lastNodePosition = position;
  const node = this.allNodes.find(n => n.key === key);
    if (node) {
      this.selectedNodeWidth = node.width || 0;
      
      this.selectedNodeHeight = node.height || 0;
    }
    this.updateJoystickPanel();
  
}


//OUTPUT:
generateOutput(onlyEdited: boolean): void {
  let output: OutputFormat = { node_override: {} };

  this.allNodes.forEach(node => {
    if (onlyEdited && !this.movedNodes.has(node.key)) return;

    const nodeDetail: NodeDetails = {
      key: node.key,
      type: node?.type,
      width: node?.width,
      height: node?.height,
      fontSize: node?.fontSize,
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
    if(node.children){
      nodeDetail.children = node.children;
    }

    if(node.maxLines){
      nodeDetail.maxLines = node.maxLines;
    }

    output.node_override[node.key] = nodeDetail;
  });


  Object.entries(output.node_override).forEach(([key, detail]) => {
    console.log(key);
    if (detail.positions && detail.positions.length === 1 && detail.type !== 'multiple') {
      detail.position = detail.positions[0];
      delete detail.positions;
    } else if (detail.positions && detail.positions.length === 0) {
      delete detail.positions; 
    }
  });

  this.outputJson.nativeElement.value = JSON.stringify(output, null, 2);
};


//OTHER UTIL METHODS:
setupJsonInputChangeSubscription(): void {
    this.jsonInputChange.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(jsonString => {
        return new Promise(resolve => {
          try {
            resolve(JSON.parse(jsonString));
          } catch (e) {
            alert("INAVLID JSON, please check again");
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

updateJoystickPanel() {
    const joystickInfo = document.querySelector('.node-info');
    if (joystickInfo && this.lastNodePosition) {
      //joystickInfo.innerHTML = `Last Selected Node: ${this.lastInteractedNodeKey}<br>Position: x=${this.lastNodePosition.x}, y=${this.lastNodePosition.y}`;
      joystickInfo.innerHTML = 
      `Selected Node: ${this.lastInteractedNodeKey}<br>
      Pos:
      x=${this.lastNodePosition?.x?.toFixed(4)},
      y=${this.lastNodePosition?.y?.toFixed(4)}<br>
      Z-index: ${this.selectedNodeZIndex} <br> 
      Height: ${this.selectedNodeHeight} |
      Width: ${this.selectedNodeWidth}`;
    }
    
  }

onNodeDragEnd(key: string, x: number, y: number): void {
    const node = this.allNodes.find(n => n.key === key);
    if (node) {
      this.updateNodePosition(key, x, y);
      this.selectedNodeWidth = node.width|| 0;
      this.selectedNodeHeight = node.height || 0;
    }
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

refreshNodeDescriptions(): void {
    this.nodesWithPositions.forEach(node => {
      const description = `${node.key} at x=${node.position.x}, y=${node.position.y}`;
      this.nodeDescriptions.push(description);
    });
  } 

  addNewNodeFromMenu(event: MenuActionEvent) {
    this.newNode.x = event.data.x; 
    this.newNode.y = event.data.y;
    this.showNodeDialog = true; 
  }

  

  confirmNewNode(type:string) {
    if(this.newNode.name.length === 0){
      alert('Please enter the node name to conitnue');
      return;
    }
    if(type === 'new'){
    const nodeName = this.formatNodeName(this.newNode.name);
    const existingNodeIndex = this.allNodes.findIndex(node => node.key === nodeName);
    if (existingNodeIndex !== -1) {
        this.removeAllVisualNodesByKey(nodeName);
        const existingNode = this.allNodes[existingNodeIndex];
        if (existingNode.position) {
            existingNode.positions = [{ x: existingNode.position.x, y: existingNode.position.y }];
            delete existingNode.position;
        }
        existingNode.positions?.push({ x: this.newNode.x, y: this.newNode.y });
        this.allNodes[existingNodeIndex] = existingNode;
        existingNode.positions?.forEach((position, index) => {
            this.createDraggableNode(existingNode, position, index);
        });
        this.movedNodes.set(existingNode.key, { ...existingNode, positions: [...existingNode.positions!] });

    } else {
        const newNode: Node = {
          key: nodeName,
          type: this.newNode.type || 'text', 
          position: {
            x: this.newNode.x,
            y: this.newNode.y
          },
          fontSize: this.newNode.fontSize,
          height:  this.newNode.height,
          width: this.newNode.width,
        };

        if(this.newNode.children && this.newNode.children.length>0){
          newNode.children = this.newNode.children;
        }

        if(this.newNode.maxLines){
          newNode.maxLines = this.newNode.maxLines;
        }

        if(this.newNode.type === 'multiple'){
          delete newNode.position;
          newNode['positions'] = [{x: this.newNode.x,y: this.newNode.y}];
        }

        this.allNodes.push(newNode);

        if(newNode.children && newNode.children.length >= 0){
          this.createTableWithChildren(newNode);
        }else{
          if(this.newNode.type === 'multiple'){
            this.createDraggableNode(newNode, newNode.positions![0], 0);
          }else{
            this.createDraggableNode(newNode, newNode.position!, -1);
          }
          
          
        }
    }
  }else if(type === 'edit'){
    const existingNode = this.allNodes.find(n => n.key === this.lastInteractedNodeKey);
    this.removeAllVisualNodesByKey(existingNode?.key!);

    const editedNewNode: Node = {
      key: this.newNode.name,
      type: this.newNode.type,
    }

    editedNewNode.height = this.newNode.height || existingNode?.height;
    editedNewNode.width = this.newNode.width || existingNode?.width;
    editedNewNode.fontSize = this.newNode.fontSize || existingNode?.fontSize;
    editedNewNode.height = this.newNode.height || existingNode?.height;
    const existingNodeIndex = this.allNodes.findIndex(node => node.key === existingNode?.key);
    if(existingNode?.position){
      editedNewNode.position = {x: this.newNode.x, y:this.newNode.y}
      this.allNodes[existingNodeIndex] = editedNewNode;
      this.createDraggableNode(editedNewNode, editedNewNode.position, -1);
    }else{
      editedNewNode.positions = existingNode?.positions || [];
      editedNewNode.positions[this.lastInteractedIndex? 
        this.lastInteractedIndex !== -1 ? 
        this.lastInteractedIndex : 0 :0] = {x: this.newNode.x, y:this.newNode.y}
    }
    this.allNodes[existingNodeIndex] = editedNewNode;
    editedNewNode.positions?.forEach((position, index) => {
      this.createDraggableNode(editedNewNode, position, index);
  });
  }

  this.generateOutput(true);
  this.resetNewNode();
}

removeAllVisualNodesByKey(nodeKey: string) {
  document.querySelectorAll(`.draggable-node[data-key="${nodeKey}"]`).forEach(node => {
      node.remove();
  });
}

resetNewNode() {
  this.newNode = { name: '', x: 0, y: 0, height: 0, width: 0, fontSize:0, type: '' };
  this.outputAvailable = true;
  this.showOutputContainer();
  this.showNodeDialog = false;
  this.saveType = 'new';
}

formatNodeName(name: string) {
    let formattedName = name?.toLowerCase()?.replace(/\s+/g, '_')?.replace(/[^a-z0-9_]/g, '');
    return formattedName;
}

  cancelNewNode() {
    this.showNodeDialog = false;
    this.showDuplicateModal = false;
  }
}