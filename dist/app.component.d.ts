import { ElementRef, AfterViewInit } from '@angular/core';
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
export declare class AppComponent implements AfterViewInit {
    pdfCanvas: ElementRef<HTMLCanvasElement>;
    contextMenu: ElementRef;
    pdfUrl: string;
    jsonInput: string;
    extractedNodes: string[];
    nodesWithPositions: {
        key: string;
        position: Position;
    }[];
    viewBoxWidth: number;
    viewBoxHeight: number;
    viewport: any;
    allNodes: Node[];
    canvas: any;
    nodeDescriptions: string[];
    contextMenuVisible: boolean;
    contextMenuPosition: {
        x: string;
        y: string;
    };
    outputJson: ElementRef<HTMLTextAreaElement>;
    movedNodes: Map<any, any>;
    output: OutputFormat;
    changeLog: string[];
    lastInteractedNodeKey: string | null;
    lastNodePosition: Position | null;
    nodeScale: any;
    widthScale: any;
    heightScale: any;
    lastInteractedIndex: number | null;
    private pdfUrlChange;
    private jsonInputChange;
    joystickVisible: boolean;
    outputAvailable: boolean;
    selectedNodeWidth: number | null;
    selectedNodeHeight: number | null;
    selectedNodeZIndex: number;
    constructor();
    ngAfterViewInit(): void;
    loadAndRenderPdf(url: string): void;
    createDraggableNode(node: Node, position: Position, index: any): void;
    makeNodeDraggable(element: HTMLElement, index: number): void;
    resetNodeColors(): void;
    changeDimension(dimension: 'width' | 'height', change: number): void;
    adjustZIndex(change: number): void;
    updateNodeElementSize(key: string): void;
    generateNodes(json: any): void;
    parseAndExtractNodes(json: any): void;
    onPdfUrlChange(newUrl: string): void;
    onJsonInputChange(event: Event): void;
    clearExistingNodes(): void;
    copyToClipboard(): void;
    toggleJoystickVisibility(): void;
    moveNode(direction: string): void;
    updateNodePosition(key: string, x: number, y: number, index?: number | null): void;
    selectNodeForJoystick(key: string, index: number | null, position: Position): void;
    generateOutput(onlyEdited: boolean): void;
    setupJsonInputChangeSubscription(): void;
    showOutputContainer(): void;
    hideOutputContainer(): void;
    updateJoystickPanel(): void;
    onNodeDragEnd(key: string, x: number, y: number): void;
    updateNodeElementPosition(key: string, position: Position, index?: number): void;
    updateDescriptionsAndAudit(key: string, index: number, newPos: Position): void;
    refreshNodeDescriptions(): void;
}
export {};
