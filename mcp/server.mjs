import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const inbox=process.env.PATCHBOOK_INBOX
  ? path.resolve(process.env.PATCHBOOK_INBOX)
  : path.join(os.homedir(),'Downloads','Patchbook');
const outbox=process.env.PATCHBOOK_OUTBOX
  ? path.resolve(process.env.PATCHBOOK_OUTBOX)
  : inbox;

async function ensureDir(dir){ await fs.mkdir(dir,{recursive:true}); }

async function reviewFiles(){
  try{
    const entries=await fs.readdir(inbox,{withFileTypes:true});
    return entries
      .filter(entry=>entry.isFile()&&entry.name.toLowerCase().endsWith('.json'))
      .map(entry=>entry.name)
      .sort();
  }catch(error){
    if(error?.code==='ENOENT')return [];
    throw error;
  }
}

async function readReview(fileName){
  const raw=await fs.readFile(path.join(inbox,fileName),'utf8');
  const review=JSON.parse(raw);
  if(!review||typeof review!=='object'||!Array.isArray(review.screens))throw new Error('Not a Patchbook review JSON file');
  return review;
}

async function writeReviewPacket(review){
  await ensureDir(outbox);
  const safeId=String(review.reviewId||Date.now()).replace(/[^a-zA-Z0-9_-]/g,'-');
  const jsonPath=path.join(outbox,'patchbook-'+safeId+'.json');
  const mdPath=path.join(outbox,'patchbook-'+safeId+'.md');
  await fs.writeFile(jsonPath,JSON.stringify(review,null,2),'utf8');
  const markdown=[
    '# PATCHBOOK REVIEW',
    '',
    'Review: '+(review.title||'Untitled review'),
    'Review ID: '+review.reviewId,
    '',
    ...(review.screens||[]).flatMap(screen=>[
      '## Screen: '+screen.filename,
      screen.viewport?'Viewport: '+screen.viewport.width+' × '+screen.viewport.height:'',
      ...(screen.annotations||[]).flatMap(annotation=>[
        '### '+String(annotation.id).padStart(2,'0')+' · '+annotation.type,
        annotation.text||'[No instruction written]',
        ''
      ]),
      ''
    ])
  ].filter(Boolean).join('\n');
  await fs.writeFile(mdPath,markdown,'utf8');
  return {jsonPath,mdPath};
}

async function allReviews(){
  const files=await reviewFiles();
  const reviews=[];
  for(const fileName of files){
    try{
      const review=await readReview(fileName);
      reviews.push({fileName,review});
    }catch{}
  }
  return reviews;
}

const server=new McpServer({
  name:'patchbook',
  version:'0.1.0'
});

server.registerTool(
  'list_reviews',
  {
    description:'List Patchbook review packets available in the local Patchbook inbox.',
    inputSchema:z.object({})
  },
  async()=>{
    const items=await allReviews();
    return {
      content:[{
        type:'text',
        text:JSON.stringify(items.map(({fileName,review})=>({
          fileName,
          reviewId:review.reviewId,
          title:review.title,
          createdAt:review.createdAt,
          screens:review.screens.length,
          annotations:review.screens.reduce((sum,screen)=>sum+screen.annotations.length,0)
        })),null,2)
      }]
    };
  }
);

server.registerTool(
  'get_latest_review',
  {
    description:'Get the most recently created Patchbook review packet from the local inbox.',
    inputSchema:z.object({})
  },
  async()=>{
    const items=await allReviews();
    if(!items.length){
      return {content:[{type:'text',text:'No Patchbook reviews found in '+inbox}]};
    }
    items.sort((a,b)=>String(b.review.createdAt).localeCompare(String(a.review.createdAt)));
    return {
      content:[{
        type:'text',
        text:JSON.stringify(items[0].review,null,2)
      }]
    };
  }
);

server.registerTool(
  'get_review',
  {
    description:'Get one Patchbook review by reviewId.',
    inputSchema:z.object({reviewId:z.string().min(1)})
  },
  async({reviewId})=>{
    const items=await allReviews();
    const match=items.find(item=>item.review.reviewId===reviewId);
    if(!match){
      return {content:[{type:'text',text:'Patchbook review not found: '+reviewId}]};
    }
    return {
      content:[{
        type:'text',
        text:JSON.stringify(match.review,null,2)
      }]
    };
  }
);

server.registerTool(
  'publish_review',
  {
    description:'Write a Patchbook review into the local agent inbox as JSON and Markdown. Use this after a review is ready for an agent.',
    inputSchema:z.object({reviewId:z.string().min(1)})
  },
  async({reviewId})=>{
    const items=await allReviews();
    const match=items.find(item=>item.review.reviewId===reviewId);
    if(!match)return {content:[{type:'text',text:'Patchbook review not found: '+reviewId}]};
    const files=await writeReviewPacket(match.review);
    return {content:[{type:'text',text:JSON.stringify({reviewId,files},null,2)}]};
  }
);

server.registerTool(
  'get_annotation',
  {
    description:'Get one annotation from a Patchbook review, including its screen, geometry, source context, and instruction.',
    inputSchema:z.object({
      reviewId:z.string().min(1),
      annotationId:z.number().int().positive()
    })
  },
  async({reviewId,annotationId})=>{
    const items=await allReviews();
    const match=items.find(item=>item.review.reviewId===reviewId);
    if(!match)return {content:[{type:'text',text:'Patchbook review not found: '+reviewId}]};
    for(const screen of match.review.screens){
      const annotation=screen.annotations.find(item=>item.id===annotationId);
      if(annotation){
        return {
          content:[{
            type:'text',
            text:JSON.stringify({
              reviewId,
              screen:{
                id:screen.id,
                filename:screen.filename,
                viewport:screen.viewport,
                source:screen.source
              },
              annotation
            },null,2)
          }]
        };
      }
    }
    return {content:[{type:'text',text:'Annotation not found: '+annotationId}]};
  }
);

const transport=new StdioServerTransport();
await server.connect(transport);
