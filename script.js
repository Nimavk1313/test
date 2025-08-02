document.addEventListener('DOMContentLoaded', () => {
    console.log('CanvasFlow Editor Initialized');

    const canvasIframe = document.getElementById('canvas');
    const layerList = document.getElementById('layer-list');

    // Responsive view switching
    const desktopView = document.getElementById('desktop-view');
    const tabletView = document.getElementById('tablet-view');
    const mobileView = document.getElementById('mobile-view');
    const responsiveButtons = [desktopView, tabletView, mobileView];

    desktopView.addEventListener('click', () => setView('desktop'));
    tabletView.addEventListener('click', () => setView('tablet'));
    mobileView.addEventListener('click', () => setView('mobile'));

    function setView(view) {
        responsiveButtons.forEach(button => button.classList.remove('active'));
        let width = '100%';
        if (view === 'desktop') {
            desktopView.classList.add('active');
        } else if (view === 'tablet') {
            tabletView.classList.add('active');
            width = '768px';
        } else {
            mobileView.classList.add('active');
            width = '375px';
        }
        canvasIframe.style.width = width;
    }

    // Default to desktop view
    setView('desktop');

    // Use a map to link layer items to canvas elements
    const layerMap = new WeakMap();

    canvasIframe.addEventListener('load', () => {
        const canvasDoc = canvasIframe.contentDocument;
        const canvasBody = canvasDoc.body;

        // Inject some base styles into the iframe
        const style = canvasDoc.createElement('style');
        style.innerHTML = `
            body {
                font-family: sans-serif;
                line-height: 1.5;
                margin: 0;
            }
            .selected {
                outline: 2px solid #1890ff !important; /* Use important to override other styles */
                outline-offset: 2px;
            }
            [data-cf-element] {
                min-height: 20px; /* Make it easier to select empty elements */
                padding: 10px;
            }
            section[data-cf-element] {
                padding: 40px 20px;
                border: 1px dashed #ccc;
            }
            div.container[data-cf-element] {
                max-width: 1140px;
                margin: 0 auto;
                padding: 20px;
                border: 1px dashed #bbb;
            }
            h1[data-cf-element] {
                font-size: 2.5rem;
            }
            /* Add a placeholder for empty containers */
            [data-cf-element]:empty::before {
                content: attr(data-cf-element);
                color: #999;
                font-style: italic;
            }
        `;
        canvasDoc.head.appendChild(style);

        const elements = document.querySelectorAll('.element');

        elements.forEach(element => {
            element.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', element.dataset.type);
            });
        });

        canvasBody.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        canvasBody.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/plain');
            const newElement = createElement(type);
            if (newElement) {
                canvasBody.appendChild(newElement);
                updateLayersPanel();
            }
        });

        function createElement(type) {
            let element;
            switch (type) {
                case 'section':
                    element = canvasDoc.createElement('section');
                    break;
                case 'container':
                    element = canvasDoc.createElement('div');
                    element.className = 'container';
                    break;
                case 'heading':
                    element = canvasDoc.createElement('h1');
                    element.textContent = 'Dynamic Heading';
                    break;
                default:
                    return null;
            }
            element.dataset.cfElement = type;
            // Give a unique ID to link layer panel
            element.dataset.cfId = `cf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            return element;
        }

        let selectedElement = null;

        function selectElement(element) {
            // Deselect previous element
            if (selectedElement) {
                selectedElement.classList.remove('selected');
            }
            const oldSelectedLayer = layerList.querySelector('.selected');
            if(oldSelectedLayer) oldSelectedLayer.classList.remove('selected');

            // Select the new element
            if (element) {
                selectedElement = element;
                selectedElement.classList.add('selected');

                const layerItem = [...layerList.children].find(li => li.dataset.cfId === selectedElement.dataset.cfId);
                if (layerItem) {
                    layerItem.classList.add('selected');
                }
                console.log('Selected:', selectedElement);
            } else {
                selectedElement = null;
            }
        }

        canvasBody.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target.closest('[data-cf-element]');
            selectElement(target);
        });

        function updateLayersPanel() {
            layerList.innerHTML = '';
            const canvasElements = canvasBody.querySelectorAll('[data-cf-element]');
            canvasElements.forEach(el => {
                const li = document.createElement('li');
                li.textContent = `${el.tagName.toLowerCase()} (${el.dataset.cfElement})`;
                li.dataset.cfId = el.dataset.cfId;
                if (el === selectedElement) {
                    li.classList.add('selected');
                }
                layerList.appendChild(li);
            });
        }

        layerList.addEventListener('click', (e) => {
            const targetLi = e.target.closest('li');
            if (targetLi) {
                const elementId = targetLi.dataset.cfId;
                const elementInCanvas = canvasDoc.querySelector(`[data-cf-id="${elementId}"]`);
                if (elementInCanvas) {
                    selectElement(elementInCanvas);
                    elementInCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    });
});
