const fs = require('fs');
const content = `'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';

type Step = 'loading' | 'redirecting' | 'verifying' | 'done' | 'error';

export default function DesktopGoogleAuthPage() {
    const searchParams = useSearchParams();
    const urlRequestId = searchParams.get('requestId')?.trim();

    const mountedRef = useRef(true);
    const initiatedRef = useRef(false);
    const [step, setStep] = useState<Step>('loading');
    const [message, setMessage] = useState('Preparing secure login…');

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const processHandoffWithToken = async (idToken: string, requestId: string) => {
        const res = await fetch('/api/desktop-auth/google', {
            method: 'PUT',
            heconst fs = require('fs');
const contn/json' },
            body:
import { useEffect, useRef, idTimport { useSearchParams } fromf (!res.ok) {
        import { CheckCircle2, Loader2 } from 'lucide-rea n
type Step = 'loading' | '} | null;
            throw n
export default function DesktopGoogleAuthPage() {
    const searchParf s    const searchParams = useSearchParams();
    ur    const urlRequestId = searchParams.get(  
    const mountedRef = useRef(true);
    const initiatedRef =oTr    const initiatedRef = useRef(fallo    const [step, setStep] = useState<St(    const [message, setMessaof window !== 'undefined') window.close();
        }, 1500);
    };

    useEffect(() => {
        if        mountedRef.cnt) return;

        // Check if we a            mountedRegl        };
    }, []);

    const procsh    }, [] w
    const'un        const res = await fetch('/api/desktop-auth/google', {
            method: .c            method: 'PUT',
            heconst fs = require( s            heconst fs = ecconst contn/json' },
            body:              body:
i  const params = new        import { CheckCircle2, Loader2 } from 'lucide-rea n
type Step = 'lt(type Step = 'loading' | '} | null;
            throw n
exp;
            throw n
export defaulgeexport default fun      const searchParf s    const searchParams = uw.    ur    const urlRequestId = searcherror) {
                setS    const mountedRef          setMessage(\`Google r turned an error: \${error}\`);
             }, 1500);
    };

    useEffect(() => {
        if        mountedRef.cnt) return;

        // Check if we a            mountedRegl        };
    }, []);

    const pRe    };

    useEn;
               if        mo('
        // Check if we a            mou\`E    }, []);

    const procsh    }, [] w
    const'un     
    con         const'un        const               method: .c            method: 'PUT',
         op, bounce to Go            heconst fs = require( s            it            body:              body:
i  const params = new        import { CheckCgei  const params = new        import);type Step = 'lt(type Step = 'loading' | '} | null;
            throw n
exp;
   tr            throw n
exp;
            throw n
expo  exp;
            
       export defaulgeexpe(                setS    const mountedRef          setMessage(\`Google r turned an error: \${error}\`);
             }, 1500);
                  }, 1500);
    };

    useEffect(() => {
        if        mount            
            co    };

    useEffectea
    ram                    cl
        // Check if we a            mouect_uri: redirectUri,
                response_type: 'id_toke
    const   
    useEn;
      nid         of        // Check if we a     u
    const procsh    }, [] w
    const'un     
    cStr    const'un     
    con       con         :          op, bounce to Go            heconst fs = require( s            it            b.ci  const params = new        import { CheckCgei  const params = new        import);type Step = 'lt(type Step 
             throw n
exp;
   tr            throw n
exp;
            throw n
expo  exp;
           to the desktop app and try again.');
exp;
   tr        rlRequeexp;
            throw        expo  exp;
       in          f       expol              }, 1500);
                  }, 1500);
    };

    useEffect(() => {
        if      <div
                className="w                  }, d-    };

    useEffect(   sty
     ba        if        moel            co    };

    useEffec-border)' }}
                                   // Check if b-0 text-c                response_type: 'id_toke
    const   
    usas    const   
    useEn;
      nid     s-    useEn;
if      nidmb    const procsh    }, [] w
    const'un     
         const'un     
    cStrep    cStr    consrg    con       con       gb             throw n
exp;
   tr            throw n
exp;
            throw n
expo  exp;
           to the desktop app and try again.');
exp;
   tr        rlRequeexp;
            throw        expo  exp;
       in          f    siexp;
   tr         lo   '#exp;
            throw        expo  exp;
                    exp;
   tr        rlRequeexp;
            thro==   er            throw      in       in          f       expol  '                   }, 1500);
    };

    useEffect(() =)}    };

    useEffect(() =>
                if      <divsN                clase
    useEffect(   sty
     ba        if        moel     <p className="text-sm mt
    useEffec-border)' }}
                      ror                       te    const   
    usas    const   
    useEn;
      nid     sssage.includes('Missing') ? (
                        useEn;
      nie       ne thif      nidmb    cons-EcoTr    const'un     
         const'un               con   ) :                       exp;
   tr            throw n
exp;
            throw n
expo  exp;
              exp;
                       {sexpo  exp;
        m         clexp;
   tr        rlRequeexp;
                                   throw      p-       in          f    siexp;
   yl   tr         lo   '#exp;
   ,6            throw       '                     exp;
   tr    g>   tr        rlRequeexp>             thro==   erla    };

    useEffect(() =)}    };

    useEffect(() =>
                if      <divsN                clase
  wi
    loc
    useEffect(() =>
    localhost:3000/auth/des    useEffect(   sty
     ba        if        moelRI     the Google Cloud    useEffec-border)' }}
                      ror                                 {    usas    const   
    useEn;
      nid   v
                     useEn;
      niou      nidp-                        useEn;
      nie           nie       ne thif      ac         const'un               con   ) :                       4,   tr            throw n
exp;
            throw n
expo  exp;
        exp;
            throw hi   roexpo  exp;
                                               m         clexp;
   tr         tr        rlRequees.wr                       esktop-google/page.tsx', content);
