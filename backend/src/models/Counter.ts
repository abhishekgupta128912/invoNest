import mongoose, { Document, Schema } from 'mongoose';

export interface ICounter extends Document {
  _id: string;
  sequence: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: {
    type: String,
    required: true
  },
  sequence: {
    type: Number,
    default: 0,
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
CounterSchema.index({ _id: 1 }, { unique: true });

export default mongoose.model<ICounter>('Counter', CounterSchema);
