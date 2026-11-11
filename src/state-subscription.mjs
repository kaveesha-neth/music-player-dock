// An older getState response must not overwrite a newer subscribed snapshot.
export function connectDockState(api,update){
 if(!api)return()=>{};
 let live=true,receivedUpdate=false;
 const unsubscribe=api.subscribe(state=>{receivedUpdate=true;if(live)update(state)});
 Promise.resolve(api.getState()).then(state=>{if(live&&!receivedUpdate)update(state)}).catch(()=>{});
 return()=>{live=false;unsubscribe()};
}
