'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {motion,animate,useReducedMotion,useScroll,useSpring} from 'motion/react';

/** Shared motion layer. Sections progressively reveal as they enter view across all routes. */
export function MotionStage({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const container=useRef<HTMLDivElement>(null);
  const reduce=useReducedMotion();
  const {scrollYProgress}=useScroll();
  const scaleX=useSpring(scrollYProgress,{stiffness:110,damping:27,mass:.2});
  useEffect(()=>{
    if(reduce||!container.current||typeof IntersectionObserver==='undefined')return;
    const root=container.current;
    const selectors=[
      'section','.page-intro','.model-hero','.docs-layout','.docs-heading',
      '.model-grid','.pricing-grid','.builder-grid','.faq-layout','.contact-panel',
      '.endpoint-list','.architecture-grid'
    ];
    const targets=[...root.querySelectorAll<HTMLElement>(selectors.join(','))];
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(({target,isIntersecting})=>{
        if(!isIntersecting)return;
        const element=target as HTMLElement;
        animate(element,{opacity:[.78,1],transform:['translateY(20px)','translateY(0px)']},
          {duration:.72,ease:[.22,1,.36,1]});
        observer.unobserve(element);
      });
    },{threshold:.08,rootMargin:'0px 0px -35px 0px'});
    targets.forEach(el=>observer.observe(el));
    return()=>observer.disconnect();
  },[pathname,reduce]);
  return <>
    {!reduce&&<motion.div className="reading-progress" style={{scaleX}} aria-hidden="true"/>}
    <motion.div ref={container} key={pathname}
      initial={reduce?false:{opacity:.88,y:12}}
      animate={{opacity:1,y:0}}
      transition={{duration:.48,ease:[.22,1,.36,1]}}>
      {children}
    </motion.div>
  </>;
}

/** A restrained single-line hero typewriter; static when reduced motion is requested. */
export function TypingAccent({words}:{words:string[]}){
  const reduce=useReducedMotion();
  const wordsKey=words.join('|');
  const [index,setIndex]=useState(0);
  const [count,setCount]=useState(words[0]?.length??0);
  useEffect(()=>{
    if(reduce||words.length<2)return;
    const value=words[index]||'';
    const timer=window.setTimeout(()=>{
      if(count<value.length)setCount(n=>n+1);
      else {setIndex(i=>(i+1)%words.length);setCount(0);}
    },count<value.length?70:2200);
    return()=>window.clearTimeout(timer);
  },[wordsKey,index,count,reduce]);
  return <em className="typing-accent" aria-label={words[0]}>
    <span aria-hidden="true">{reduce?words[0]:words[index]?.slice(0,count)}</span>
    {!reduce&&<span className="typing-caret" aria-hidden="true"/>}
  </em>;
}
