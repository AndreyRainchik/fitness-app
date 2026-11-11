import React from 'react';

/** White panel used for every content block. */
function Card({ className = '', padding = 'p-4 sm:p-6', children, ...props }) {
  return (
    <div className={`bg-white rounded-lg shadow ${padding} ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;
