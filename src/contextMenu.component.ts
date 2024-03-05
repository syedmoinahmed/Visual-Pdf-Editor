

import { Component, ElementRef, HostListener, EventEmitter, ViewChild, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';


interface MenuActionEvent {
    action: string;
    data?: any;
  }


@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
 <div id="context-menu" class="context-menu" [ngStyle]="{'display': menuVisible ? 'block' : 'none', 'top': position.y + 'px', 'left': position.x + 'px'}">
      <ul>
      <li *ngFor="let option of menuOptions" (click)="onMenuOptionSelect(option.id)">{{option.label}}</li>
      </ul>
    </div>

  `,
  styles: [
    `
.context-menu {
  border: 1px solid #ccc;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
  position: absolute;
  z-index: 1000;
  background-color: #fff;
  padding: 10px 0;
  margin: 0;
  list-style: none;
}

.context-menu ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

.context-menu li {
  padding: 8px 12px;
  cursor: pointer;
}

.context-menu li:hover {
  background-color: #f5f5f5;
}


    `,
  ]
})

export class ContextMenuComponent {
    @Output() menuAction: EventEmitter<MenuActionEvent> = new EventEmitter();
    @ViewChild('pdfCanvas', { static: true }) pdfCanvas!: ElementRef<HTMLCanvasElement>;

    menuVisible = false;
    position = { x: 0, y: 0 };
    menuOptions = [
        { id: 'print', label: 'Show clicked x and y'},
        { id: 'addNode', label: 'Add New Node'}
      ];
  
  
    
    @HostListener('document:contextmenu', ['$event'])
    onRightClick(event: MouseEvent) {
        const pdfContainer = document.querySelector('.pdf-container');
    
        if (pdfContainer && pdfContainer.contains(event.target as Node)) {
          event.preventDefault();
          this.menuVisible = true;
    
          if (pdfContainer) {
            const canvasRect = pdfContainer.getBoundingClientRect();
    
            const adjustedX = canvasRect.left + event.clientX;
            const adjustedY = window.scrollY + event.clientY;
    
            this.position.x = adjustedX;
            this.position.y = adjustedY;
          } else {
            console.error('PDF container not found');
          }
        } else {
          this.menuVisible = false;
        }
      }

    @HostListener('document:click')
    onClick() {
      this.menuVisible = false;
    }

    onMenuOptionSelect(optionId: string) {
        this.hideMenu();
        let eventData: MenuActionEvent = { action: optionId, data: null };
        switch(optionId) {
          case 'addNode':
            eventData.data = { x: this.position.x, y: this.position.y };
            break;
        case 'print':
            this.printStuff();
            break;
          
        }
    
        this.menuAction.emit(eventData);
      }
  
    printStuff() {
    alert(`The current x and y is x:${this.position.x} and y:${this.position.y}`);
    }

    hideMenu() {
        this.menuVisible = false;
      }
  }