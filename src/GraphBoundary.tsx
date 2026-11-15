import {Component} from 'react';
import type {ReactNode} from 'react';
export class GraphBoundary extends Component<{children:ReactNode;onFallback:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="network-wrap three-loading"><p>이 환경에서는 3D 지도를 표시할 수 없습니다.</p><button onClick={this.props.onFallback}>2D 지도로 보기</button></div>:this.props.children;}
}
