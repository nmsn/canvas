
"use client"
import { useEffect } from 'react';
import Sortable from 'sortablejs';
import styles from './index.module.css';
const SortablePage = () => {
  useEffect(() => {
    const gridDemo = document.getElementById('gridDemo');
    // Grid demo
    if (gridDemo) {
      new Sortable(gridDemo, {
        animation: 150,
        ghostClass: 'blue-bg', // 占位元素
        dragClass: 'yellow-bg', // 鼠标下的拖拽元素幽灵图
        chosenClass: 'red-bg', // 上面两个都会被设置颜色，会被覆盖（先执行的）
        group: 'shared',
      });
    }

    const gridDemo2 = document.getElementById('gridDemo2');
    // Grid demo
    if (gridDemo2) {
      new Sortable(gridDemo2, {
        animation: 150,
        // ghostClass: 'blue-bg',
        // chosenClass: 'red-bg',
        // dragClass: 'yellow-bg',

        group: {
          name: 'shared',
          pull: 'clone',
          put: false // Do not allow items to be put into this list
        },
      });
    }

  }, [])
  return (
    <div id="grid" className="row">
      <h4 className="col-12">Grid Example</h4>
      <div id="gridDemo" className={styles.container + ' col'}>
        <div className={styles['grid-square']}>Item 1</div>
        <div className={styles['grid-square']}>Item 2</div>
        <div className={styles['grid-square']}>Item 3</div>
        <div className={styles['grid-square']}>Item 4</div>
      </div>
      <h4 className="col-12">Grid Example</h4>
      <div id="gridDemo2" className={styles.container + ' col'}>
        <div className={styles['grid-square']}>Item 11</div>
        <div className={styles['grid-square']}>Item 22</div>
      </div>


      <div className="w-100 h-100 bg-amber-400" draggable="true" id='test' 
        onDragStart={(e) => {
          const test2Element = document.getElementById('test2');
          if (test2Element) {
            e.dataTransfer.setDragImage(test2Element, 10, 10);
          }
        }}
      >123</div>
      <div className="w-20 h-20 bg-amber-400" id="test2">
        <div className="w-10 h-10 bg-blue-400">0</div>
        </div>
    </div>
  );
};

export default SortablePage;