import type {SelectHTMLAttributes} from 'react';
import Icon from './Icon';
/** Native select behavior, with the same visible icon and alignment in every filter sheet. */
export default function FilterSelect({label,children,...props}:SelectHTMLAttributes<HTMLSelectElement>&{label:string}){
 return <label className="field filter-field"><span>{label}</span><span className="filter-select-control"><select {...props} aria-label={props['aria-label']??label}>{children}</select><Icon name="arrowDown"/></span></label>;
}
